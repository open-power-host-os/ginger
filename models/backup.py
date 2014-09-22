#
# Project Ginger
#
# Copyright IBM, Corp. 2014
#
# This library is free software; you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public
# License as published by the Free Software Foundation; either
# version 2.1 of the License, or (at your option) any later version.
#
# This library is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# Lesser General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public
# License along with this library; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA

import errno
import hashlib
import itertools
import os
import time
import uuid

import cherrypy

from kimchi.config import PluginPaths
from kimchi.exception import NotFoundError, OperationFailed, TimeoutExpired
from kimchi.utils import kimchi_log, run_command


class BackupModel(object):
    def __init__(self, **kargs):
        self._objstore = kargs['objstore']
        self._archives_model = kargs['archives_model']
        self._archive_model = kargs['archive_model']

    def _get_archives_to_discard(self, archives, days_ago, counts_ago):
        if days_ago == 0 or counts_ago == 0:
            return archives[:]

        to_remove = []

        # Older archive comes first.
        archives.sort(lambda l, r: cmp(l['timestamp'], r['timestamp']))

        if counts_ago != -1:
            to_remove.extend(archives[:-counts_ago])
            archives = archives[-counts_ago:]

        if days_ago != -1:
            expire = time.time() - 3600 * 24 * days_ago
            to_remove.extend(
                itertools.takewhile(
                    lambda ar: ar['timestamp'] < expire, archives))

        return to_remove

    def discard_archives(self, _ident, days_ago=-1, counts_ago=-1):
        ''' Discard archives older than some days ago, or some counts ago. '''
        with self._objstore as session:
            archives = [
                session.get(ArchivesModel._objstore_type, ar_id)
                for ar_id in self._archives_model._session_get_list(session)]

            to_remove = self._get_archives_to_discard(
                archives, days_ago, counts_ago)

            for ar in to_remove:
                self._archive_model._session_delete_archive(session,
                                                            ar['identity'])


def _tar_create_archive(directory_path, archive_id, include, exclude):
    archive_file = os.path.join(directory_path, archive_id + '.tar.gz')
    exclude = ['--exclude=' + toExclude for toExclude in exclude]
    cmd = ['tar', '--create', '--gzip',
           '--absolute-names', '--file', archive_file,
           '--selinux', '--acl', '--xattrs'] + exclude + include
    timeout = int(cherrypy.request.app.config['backup']['timeout'])
    out, err, rc = run_command(cmd, timeout)
    if rc != 0:
        raise OperationFailed(
            'GINHBK0001E', {'name': archive_file, 'cmd': ' '.join(cmd)})

    return archive_file


def _sha256sum(filename):
    sha = hashlib.sha256()
    with open(filename, 'rb') as f:
        for c in iter(lambda: f.read(131072), ''):
            sha.update(c)
    return sha.hexdigest()


class ArchivesModel(object):
    _objstore_type = 'ginger_backup_archive'
    _archive_dir = os.path.join(PluginPaths('ginger').state_dir,
                                'ginger_backups')

    def __init__(self, **kargs):
        self._objstore = kargs['objstore']
        self._create_archive_dir()

    @classmethod
    def _create_archive_dir(cls):
        try:
            os.makedirs(cls._archive_dir)
        except OSError as e:
            # It's OK if archive_dir already exists
            if e.errno != errno.EEXIST:
                kimchi_log.error('Error creating archive dir %s: %s',
                                 cls._archive_dir, e)
                raise OperationFailed('GINHBK0003E',
                                      {'dir': cls._archive_dir})

    @property
    def _default_include(self):
        # This function builds a new copy of the list for each invocation,
        # so that the caller can modify the returned list as wish without
        # worrying about changing the original reference.
        return list(cherrypy.request.app.config['backup']['default_include'])

    @property
    def _default_exclude(self):
        # See _default_include() comments for explanation.
        return list(cherrypy.request.app.config['backup']['default_exclude'])

    def _create_archive(self, params):
        error = None
        try:
            params['file'] = _tar_create_archive(
                self._archive_dir, params['identity'], params['include'],
                params['exclude'])
            params['checksum'] = {'algorithm': 'sha256',
                                  'value': _sha256sum(params['file'])}

            with self._objstore as session:
                session.store(self._objstore_type, params['identity'], params)
        except TimeoutExpired as e:
            error = e
            reason = 'GINHBK0010E'
        except Exception as e:
            error = e
            reason = 'GINHBK0009E'

        if error is not None:
            msg = 'Error creating archive %s: %s' % (params['identity'], error)
            kimchi_log.error(msg)

            try:
                with self._objstore as session:
                    session.delete(self._objstore_type, params['identity'],
                                   ignore_missing=True)
            except Exception as e_session:
                kimchi_log.error('Error cleaning archive meta data %s. '
                                 'Error: %s', params['identity'], e_session)

            if params['file'] != '':
                try:
                    os.unlink(params['file'])
                except Exception as e_file:
                    kimchi_log.error('Error cleaning archive file %s. '
                                     'Error: %s', params['file'], e_file)

            raise OperationFailed(reason, {'identity': params['identity']})

    def create(self, params):
        archive_id = str(uuid.uuid4())
        stamp = int(time.mktime(time.localtime()))

        # Though formally we ask front-end to not send "include" at all when
        # it's empty, but in implementation we try to be tolerant.
        # Front-end can also send [] to indicate the "include" is empty.
        include = params.get('include')
        exclude = params.get('exclude', [])
        if not include:
            include = self._default_include
            if not exclude:
                exclude = self._default_exclude

        ar_params = {'identity': archive_id,
                     'include': include,
                     'exclude': exclude,
                     'description': params.get('description', ''),
                     'checksum': {},
                     'timestamp': stamp,
                     'file': ''}
        self._create_archive(ar_params)

        return archive_id

    def _session_get_list(self, session):
        # Assume session is already locked.
        return session.get_list(self._objstore_type, sort_key='timestamp')

    def get_list(self):
        with self._objstore as session:
            return self._session_get_list(session)


class ArchiveModel(object):
    def __init__(self, **kargs):
        self._objstore = kargs['objstore']

    def lookup(self, archive_id):
        with self._objstore as session:
            info = session.get(ArchivesModel._objstore_type, archive_id)
        return info

    def _session_delete_archive(self, session, archive_id):
        # Assume session is already locked.
        try:
            ar_params = session.get(ArchivesModel._objstore_type, archive_id)
        except NotFoundError:
            return

        if ar_params['file'] != '':
            try:
                os.unlink(ar_params['file'])
            except OSError as e:
                # It's OK if the user already removed the file manually
                if e.errno not in (errno.EACCES, errno.ENOENT):
                    raise OperationFailed(
                        'GINHBK0002E', {'name': ar_params['file']})

        session.delete(ArchivesModel._objstore_type, archive_id)

    def delete(self, archive_id):
        with self._objstore as session:
            self._session_delete_archive(session, archive_id)
