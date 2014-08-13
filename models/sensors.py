# -*- coding: utf8 -*-

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

import re
import cherrypy

from collections import OrderedDict

from kimchi.utils import kimchi_log
from kimchi.utils import run_command


class SensorsModel(object):
    """
    The model class for polling host sensor data
    """

    def lookup(self, params):
        def convert_units(dev_name, sensor_line, temperature_unit):
            """
            Do three things:
            1. Convert from C to F if needed.
            2. Make all numbers floats.
            3. Make sure no 'max' temp is 0.
            """
            fallback_max = 100.0 if temperature_unit == 'C' else 212.0
            name = sensor_line[0]
            val = float(sensor_line[1])
            if 'fan' not in dev_name and \
                    'power' not in dev_name:
                if(abs(val) < 1):
                    if "max" in name:
                        val = fallback_max
                    elif "alarm" in name:
                        # unwise to modify '0' alarm val
                        val = 0.0
                elif(temperature_unit == 'F'):
                    val = 9.0/5.0 * val + 32
            return (name, val)

        def parse_sensors(temperature_unit):
            command = ['sensors', '-u']
            sens_out, error, rc = run_command(command)
            if rc:
                kimchi_log.error("Error retrieving sensors data: %s: %s." %
                                 (error, rc))

            devices = OrderedDict()
            for section in sens_out.split('\n\n'):
                """
                    A device consists of possibly multiple sensors, each
                    with a possible current, max, alarm, and critical temp,
                    or just a current and max (for fans, for example).
                    Each is broken into sections separated by a blank line,
                    and will have two headings:
                        amb-temp-sensor-isa-0000
                        Adapter: ISA adapter
                """
                # The first line of each device section is the device name,
                #   e.g., amb-temp-sensor-isa-0000
                dev_name, sep, section = section.partition('\n')
                sub_devices = OrderedDict()
                """
                    Two sub-devices of a CPU device:
                    Physical id 0:
                        temp1_input: 48.000
                        temp1_max: 87.000
                        temp1_crit: 105.000
                        temp1_crit_alarm: 0.000
                    Core 0:
                        temp2_input: 48.000
                        temp2_max: 87.000
                        temp2_crit: 105.000
                        temp2_crit_alarm: 0.000

                """
                if dev_name is not '':
                    # The second line, e.g. Adapter: ISA adapter, isn't
                    #   unique, so it is discarded.
                    throw_away, sep, section = section.partition('\n')
                    # A device may have multiple sub-devices, listed
                    #   in separate groups. Split this section/device
                    #   into lines to parse each sub-device.
                    # Each sub-device (e.g. Core 0) has a unique sensor.
                    device = section.splitlines()
                    sensor_name = ''
                    sensor = []
                    # Parse backwards, because you don't want to add a
                    #   new device to the dict until you have all sub-
                    #   device sensors.
                    for line in reversed(device):
                        try:
                            # Get all ':'-separated elements from a line.
                            # This may be the name of the sub-device,
                            # or a name:value pair for a temp.
                            data_line = line.split(': ')
                            data_line = [x.strip().strip(':')
                                         for x in data_line]
                            if len(data_line) > 1:  # name:value pair
                                sensor.append(convert_units(
                                    dev_name, data_line, temperature_unit))
                            else:  # Sub-device name
                                sensor_name = data_line[0]
                                sub_devices[sensor_name] = \
                                    OrderedDict(reversed(sensor))
                                sensor = []
                        except Exception:
                            pass
                    """
                        Add the entire device (e.g. all cores and their
                        max, min, crit, alarm) as one dict. Reverse it
                        so that fans, CPUs, etc. are in order.
                    """
                    devices[dev_name] = \
                        OrderedDict(reversed(sub_devices.items()))
                    # Also add the unit for the device:
                    unit = temperature_unit
                    if 'fan' in sensor_name:
                        unit = 'RPM'
                    elif 'power' in sensor_name:
                        unit = 'W'
                    devices[dev_name]['unit'] = unit
            return devices

        def parse_hdds(temperature_unit):
            # hddtemp has no issues with F <-> C conversion
            out, error, rc = run_command(['hddtemp', '-u', '%s' %
                                         str(temperature_unit)])
            if rc:
                kimchi_log.error("Error retrieving HD temperatures: rc %s."
                                 "output: %s" % (rc, error))
                return None

            hdds = OrderedDict()

            for hdd in out.splitlines():
                try:
                    hdd_items = hdd.split(':')
                    hdd_name, hdd_temp = hdd_items[0], hdd_items[2]
                    hdds[hdd_name] = \
                        float(re.sub('°[C|F]', '', hdd_temp).strip())
                except Exception:
                    pass
            hdds['unit'] = temperature_unit
            return hdds

        # Don't store the unit parameter passed in permanently so that
        #   the setting stored in the config file is what everyone will
        #   see, and the UI will not bounce between 'C' and 'F' if
        #   a lot of querying is going on from different sources.
        self.temperature_unit =\
            cherrypy.request.app.config['unit']['temperature']
        override_unit = None
        if params is not None:
            override_unit = params.get('temperature_unit')
        cur_unit = self.temperature_unit if override_unit is None \
            else override_unit
        sensors = parse_sensors(cur_unit)
        hdds = parse_hdds(cur_unit)
        return {'sensors': sensors, 'hdds': hdds}
