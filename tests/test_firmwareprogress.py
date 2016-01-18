#
# Project Ginger
#
# Copyright IBM, Corp. 2015
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

import unittest

from kimchi import config
from kimchi.objectstore import ObjectStore
from models.firmware import FirmwareProgressModel


class FirmwareProgressTests(unittest.TestCase):
    def setUp(self):
            objstore_loc = config.get_object_store() + '_ginger'
            self._objstore = ObjectStore(objstore_loc)

    def test_fwprogress_without_update_flash(self):
        fwprogress = FirmwareProgressModel(objstore=self._objstore)
        task_info = fwprogress.lookup()
        self.assertEquals('finished', task_info['status'])
        self.assertEquals('Error', task_info['message'])
        self.assertEquals('/plugins/ginger/fwprogress',
                          task_info['target_uri'])
