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

from backup import ArchiveModel, ArchivesModel, BackupModel
from firmware import FirmwareModel
from interfaces import InterfacesModel, InterfaceModel
from kimchi import config
from kimchi.basemodel import BaseModel
from kimchi.objectstore import ObjectStore
from network import NetworkModel
from powermanagement import PowerProfilesModel, PowerProfileModel
from sanadapters import SanAdapterModel, SanAdaptersModel
from sensors import SensorsModel
from users import UsersModel, UserModel


class GingerModel(BaseModel):

    def __init__(self):
        objstore_loc = config.get_object_store() + '_ginger'
        self._objstore = ObjectStore(objstore_loc)

        sub_models = []
        firmware = FirmwareModel()
        powerprofiles = PowerProfilesModel()
        powerprofile = PowerProfileModel()
        users = UsersModel()
        user = UserModel()
        interfaces = InterfacesModel()
        interface = InterfaceModel()
        network = NetworkModel()
        archives = ArchivesModel(objstore=self._objstore)
        archive = ArchiveModel(objstore=self._objstore)
        backup = BackupModel(objstore=self._objstore, archives_model=archives,
                             archive_model=archive)
        san_adapters = SanAdaptersModel()
        san_adapter = SanAdapterModel()
        sensors = SensorsModel()

        sub_models = [
            backup, archives, archive,
            firmware,
            interfaces, interface,
            network,
            powerprofiles, powerprofile,
            users, user,
            san_adapters, san_adapter,
            sensors]
        super(GingerModel, self).__init__(sub_models)
