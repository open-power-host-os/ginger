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

import os.path
import subprocess

from parted import Device as PDevice
from parted import Disk as PDisk

from wok.exception import OperationFailed
from wok.utils import run_command, wok_log
from wok.plugins.gingerbase.disks import _get_dev_major_min
from wok.plugins.gingerbase.disks import _get_dev_node_path


def _get_swapdev_list_parser(output):
    """
    This method parses the output of 'cat /proc/swaps' command
    :param output: output of 'cat /proc/swaps' command
    :return:list of swap devices
    """
    output = output.splitlines()
    output_list = []

    try:
        for swapdev in output[1:]:
            dev_name = swapdev.split()[0]
            output_list.append(dev_name)
    except Exception, e:
        wok_log.error("Error parsing /proc/swaps file.")
        raise OperationFailed("GINSP00010E", {'err', e.message})

    return output_list


def _create_file(size, file_loc):
    """
    Create a flat file to be used as a swap device
    :param file_loc: file location
    :param size: size of the file
    :return:
    """
    out, err, rc = run_command(
        ["dd", "if=/dev/zero", "of=" + file_loc, "bs=" + size, "count=1"])

    if rc != 0:
        wok_log.error("Error creating a flat file. %s", file_loc)
        raise OperationFailed("GINSP00011E", {'err': err})

    # So that only root can see the content of the swap
    os.chown(file_loc, 0, 0)
    os.chmod(file_loc, 0600)

    return


def _make_swap(file_loc):
    """
    Format a device as a swap device
    :param file_loc: file location or a device path
    :return:
    """

    out, err, rc = run_command(["mkswap", file_loc])

    if rc != 0:
        wok_log.error("Unable to format swap device. %s", file_loc)
        raise OperationFailed("GINSP00012E", {'err': err})
    return


def _activate_swap(file_loc):
    """
    Activate a swap device
    :param file_loc: file location or a device path
    :return:
    """
    out, err, rc = run_command(["swapon", file_loc])
    if rc != 0:
        wok_log.error("Unable to activate swap device. %s", file_loc)
        raise OperationFailed("GINSP00013E", {'err': err})
    return


def _parse_swapon_output(output):
    """
    :param output: output of 'grep -w devname /proc/swaps' command
    :return:
    """
    try:
        output_dict = {}
        output_list = output.split()
        output_dict['filename'] = output_list[0]
        output_dict['type'] = output_list[1]
        output_dict['size'] = output_list[2]
        output_dict['used'] = output_list[3]
        output_dict['priority'] = output_list[4]
    except Exception, e:
        wok_log.error("Unable to parse 'swapon -s' output")
        raise OperationFailed("GINSP00014E", {'err': e.message})

    return output_dict


def _get_swap_output(device_name):
    """
    :param device_name: swap device path
    :return:
    """
    out, err, rc = run_command(["grep", "-w", device_name, "/proc/swaps"])

    if rc != 0:
        wok_log.error("Unable to get single swap device info. %s", device_name)
        raise OperationFailed("GINSP00015E", {'err': err})

    return _parse_swapon_output(out)


def _swapoff_device(device_name):
    """
    Remove a swap device
    :param device_name: file or device path
    :return:
    """
    out, err, rc = run_command(["swapoff", device_name])

    if rc != 0:
        wok_log.error("Unable to deactivate swap device. %s", device_name)
        raise OperationFailed("GINSP00016E", {'err': err})

    return


def change_part_type(part, type_hex):
    """
    Change the type of the given partition
    :param part: partition number on the device
    :param type_hex: partition type in hex
    :return:
    """
    devname = ''.join(i for i in part if not i.isdigit())
    majmin = _get_dev_major_min(devname)

    dev_path = _get_dev_node_path(majmin)
    partnum = ''.join(filter(lambda x: x.isdigit(), part))

    device = PDevice(dev_path)
    disk = PDisk(device)
    parts = disk.partitions

    if len(parts) == 1:
        typ_str = '\nt\n' + type_hex + '\n' + 'w\n'
    elif len(parts) > 1:
        typ_str = '\nt\n' + partnum + '\n' + type_hex + '\n' + 'w\n'
    else:
        wok_log.error("No partitions found for disk,  %s", disk)
        raise OperationFailed("GINSP00017E",
                              {'disk': "No partitions found for disk " + disk})

    t1_out = subprocess.Popen(["echo", "-e", "\'", typ_str, "\'"],
                              stdout=subprocess.PIPE)
    t2_out = subprocess.Popen(["fdisk",
                               dev_path], stdin=t1_out.stdout,
                              stderr=subprocess.PIPE, stdout=subprocess.PIPE)
    t1_out.stdout.close()
    out, err = t2_out.communicate()

    if t2_out.returncode != 0:
        wok_log.error("Unable to change the partition type.")
        raise OperationFailed("change type failed", err)

    return part


def create_disk_part(dev, size):
    """
    This method creates a partition on the specified device
    :param dev: path of the device for which partition is to be created
    :param size: size of the partition (e.g 10M)
    :return:
    """
    p_str = _form_part_str(size)
    p1_out = subprocess.Popen(["echo", "-e", "\'", p_str, "\'"],
                              stdout=subprocess.PIPE)
    p2_out = subprocess.Popen(["fdisk", dev], stdin=p1_out.stdout,
                              stderr=subprocess.PIPE, stdout=subprocess.PIPE)
    p1_out.stdout.close()
    out, err = p2_out.communicate()
    if p2_out.returncode != 0:
        raise OperationFailed("GINPART00011E", err)
    part_path = get_dev_part(dev)
    return part_path.split('/')[2]


def _form_part_str(size):
    """
    Forms the string containing the size to be used in fdisk command
    :param size:size of the partition
    :return:
    """
    part_str = '\nn\np\n\n\n' + '+' + size + '\n' + 'w\n'
    return part_str


def get_dev_part(dev):
    """
    This method fetches the path of newly created partition
    :param dev: path of the device which is partitioned
    :return:
    """
    part_paths = []
    device = PDevice(dev)
    disk = PDisk(device)
    parts = disk.partitions
    for part in parts:
        part_paths.append(part.path)
    return part_paths[len(part_paths) - 1]


def _is_mntd(partition_name):
    """
    Checks if the partition is already mounted
    :param partition_name: name of the partition
    :return:
    """
    mtd_out, err, rc = run_command(["grep", "-w",
                                    "^/dev/" + partition_name +
                                    "\s", "/proc/mounts"])
    if rc != 0:
        return False
    else:
        return True


def _makefs(fstype, name):
    """
    Formats the partition with the specified file system type
    :param fstype: type of filesystem (e.g ext3, ext4)
    :param name: name of the partition to be formatted (e.g sdb1)
    :return:
    """
    fs_out, err, rc = run_command(["mkfs", "-t", fstype, "-F", name])
    if rc != 0:
        raise OperationFailed("GINPART00012E", {'err': err})
    return


def delete_part(partname):
    """
    Deletes the specified partition
    :param partname: name of the partition to be deleted
    :return:
    """
    devname = ''.join(i for i in partname if not i.isdigit())
    majmin = _get_dev_major_min(devname)
    dev_path = _get_dev_node_path(majmin)
    partnum = ''.join(filter(lambda x: x.isdigit(), partname))
    device = PDevice(dev_path)
    disk = PDisk(device)
    parts = disk.partitions
    if len(parts) == 1:
        typ_str = '\nd\nw\n'
    elif len(parts) > 1:
        typ_str = '\nd\n' + partnum + '\n' + 'w\n'
    else:
        raise OperationFailed("GINPART00013E")
    d1_out = subprocess.Popen(["echo", "-e", "\'", typ_str, "\'"],
                              stdout=subprocess.PIPE)
    d2_out = subprocess.Popen(["fdisk", dev_path], stdin=d1_out.stdout,
                              stderr=subprocess.PIPE, stdout=subprocess.PIPE)
    d1_out.stdout.close()
    out, err = d2_out.communicate()
    if d2_out.returncode != 0:
        raise OperationFailed("GINPART00011E", err)