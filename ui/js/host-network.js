/*
 * Copyright IBM Corp, 2015-2016
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 */

// This variable is used while deleting multiple interfaces
// to pass the interface name in case of error message print
ginger.selectedNWInterface = null;

ginger.initOvsBridges = function() {
  if(ginger.ovsbridges !== undefined && !ginger.ovsbridges){
    $('#ovsbridge-container').remove();
  }else {
    $('#ovsbridge-container').removeClass('hidden');
    var ovsAccordion = wok.substitute($('#ovsBridgesPanel').html());
    $('#ovsbridge-container').append(ovsAccordion);
    ginger.listOvsBridges();
    ginger.initOvsClickHandler();
  }
}

ginger.refreshOvsBridges = function() {
  if($("#ovsbridgeList .collapse.in").length > 0) {
    $("#ovsbridgeList .collapse.in").one('hidden.bs.collapse',function(e){
      e.stopPropagation();
      ginger.refreshOvsBridgesUi();
    });
    $("#ovsbridgeList .collapse.in").collapse("hide");
  }else {
    ginger.refreshOvsBridgesUi();
  }
}

ginger.refreshOvsBridgesUi = function(){
    $('#ovsbridgeList').height($('#ovsbridgeList').innerHeight());
    $('#ovsbridge-content-area .wok-mask').removeClass('hidden');
    $('#ovsbridgeList').empty();
    ginger.listOvsBridges();
}

ginger.listOvsBridges = function() {
    ginger.getOvsBridges(function(result) {
      if (result && result.length) {
        result.sort(function(a, b) {
            return a.name.localeCompare( b.name );
        });
        $.each(result, function(i,value){
            var id = i + 1 + '-' + value.name.toLowerCase();
            var collapse_target = 'bridge-'+id+'-interfaces';
            var name = value.name;
            var bonds = [];
            var interfaces = [];
            var interfaceCount = '';
            var bondCount = '';
            var interfacePlus = '';
            var bondPlus = '';
            var empty_bond_stat = $();
            var empty_iface_stat = $();
            var emptyPortHtml = '<span title="'+i18n['GINNET0056M']+'">'+i18n['GINNET0056M']+'</span>';
            $('#bridge-'+id+' > .column-bonds, #bridge-'+id+' > .column-interfaces').empty().append(emptyPortHtml);
            if(Object.keys(value.ports).length){
              $.each(value.ports, function(j,interface){
                if(interface.type === 'bond') {
                  bonds.push(interface.name);
                  $.each(interface.interfaces, function(k,bondiface){
                    var state = (bondiface.admin_state === 'up' && bondiface.link_state === 'up' ) ? i18n['GINNET0040M'] : i18n['GINNET0041M'];
                    var stateClass = (bondiface.admin_state === 'up' && bondiface.link_state === 'up' ) ? 'up' : 'down';
                    var bondIfaceStatItem = $.parseHTML(wok.substitute($("#interfaceBodyTmpl").html(), {
                        id: bondiface.name,
                        name: bondiface.name + ' ('+interface.name+')',
                        state: state,
                        stateClass: stateClass,
                        rxBytes: bondiface.statistics.rx_bytes,
                        txBytes: bondiface.statistics.tx_bytes,
                        rxPackets: bondiface.statistics.rx_packets,
                        txPackets: bondiface.statistics.tx_packets,
                        rxErr: bondiface.statistics.rx_errors,
                        txErr: bondiface.statistics.tx_errors
                    }));
                    empty_bond_stat = empty_bond_stat.add(bondIfaceStatItem);
                  });
                }else if(interface.type === 'interface'){
                  interfaces.push(interface.name);
                  var state = (interface.admin_state === 'up' && interface.link_state === 'up' ) ? i18n['GINNET0040M'] : i18n['GINNET0041M'];
                  var stateClass = (interface.admin_state === 'up' && interface.link_state === 'up' ) ? 'up' : 'down';
                  var IfaceStatItem = $.parseHTML(wok.substitute($("#interfaceBodyTmpl").html(), {
                      id: interface.name,
                      name: interface.name,
                      state: state,
                      stateClass: stateClass,
                      rxBytes: interface.statistics.rx_bytes,
                      txBytes: interface.statistics.tx_bytes,
                      rxPackets: interface.statistics.rx_packets,
                      txPackets: interface.statistics.tx_packets,
                      rxErr: interface.statistics.rx_errors,
                      txErr: interface.statistics.tx_errors
                  }));
                  empty_iface_stat = empty_iface_stat.add(IfaceStatItem);
                  }
              });
            }
            if(interfaces.length){
              if(interfaces.length > 3){
                interfacePlus = i18n['GINNET0061M'].replace("%1", (interfaces.length - 3));
                interfaces = interfaces.slice(0,3);
                interfaces[2] = interfaces[2]+'...';
              }
              interfaceCount = interfaces.join(', ');
            }else {
              interfaceCount = i18n['GINNET0056M'];
              interfacePlus = i18n['GINNET0056M'];
            }
            if(bonds.length){
              if(bonds.length > 3){
                bondPlus = i18n['GINNET0060M'].replace("%1", (bonds.length - 3));
                bonds = bonds.slice(0,3);
                bonds[2] = bonds[2]+'...';
              }
              bondCount = bonds.join(', ');
            }else {
              bondCount = i18n['GINNET0056M'];
              bondPlus = i18n['GINNET0056M'];
            }
            var ovsbridgeItem = $.parseHTML(wok.substitute($("#ovsbridgeTmpl").html(), {
                id: id,
                name: name,
                bonds: bondCount,
                interfaces: interfaceCount,
                bondPlus: bondPlus,
                interfacePlus: interfacePlus
            }));
            if(empty_bond_stat.length){
              $('.bridge-interfaces-body', ovsbridgeItem).append(empty_bond_stat);
            }
            if(empty_iface_stat.length){
              $('.bridge-interfaces-body', ovsbridgeItem).append(empty_iface_stat);
            }
            if(empty_iface_stat.length || empty_bond_stat.length){
              var stat_handle = $('<span role="button" class="handle" data-toggle="collapse" data-target="#'+collapse_target+'"><i class="fa fa-chevron-down"></i></span>');
              $('.column-statistics', ovsbridgeItem).append(stat_handle);
              $('.bridge-interface', ovsbridgeItem).dataGrid({enableSorting: false});
            }else {
              $('.column-statistics', ovsbridgeItem).append('--');
            }
            $('#ovsbridgeList').height('auto').append(ovsbridgeItem);
        });
        $('#add_ovsbridge_button').prop('disabled',false);
        $('#ovs_search_input').prop('disabled',false);
        if($('#ovsbridgeGrid').hasClass('wok-datagrid')) {
            $('#ovsbridgeGrid').dataGrid('destroy');
        }
        $('#ovsbridgeGrid').dataGrid({enableSorting: false});
        $('#ovsbridge-content-area .wok-mask').addClass('hidden');
        $('#ovsbridgeGrid').removeClass('hidden');
        $("#ovsbridgeList > .wok-datagrid-row> span > [data-toggle=collapse]").click(function(e){
            e.preventDefault();
            e.stopPropagation();
            $("#ovsbridgeList > .wok-datagrid-row > div > .collapse.in").collapse("hide");
            $($(this).attr("data-target")).collapse("show");
        });
        var ovsBridgeOptions = {
            valueNames: ['name-filter', 'bond-filter', 'interface-filter']
        };
        var ovsBridgeFilterList = new List('ovsbridge-content-area', ovsBridgeOptions);

        ovsBridgeFilterList.sort('name-filter', {
            order: "asc"
        });

      }else {
        var emptyIList = '<div id="no-results" class="bridge"<span class="no-results">'+i18n['GINNET0056M']+'</span>';
        $('#ovsbridgeList').append(emptyIList);
        if($('#ovsbridgeGrid').hasClass('wok-datagrid')) {
            $('#ovsbridgeGrid').dataGrid('destroy');
        }
        $('#ovsbridgeGrid').dataGrid({enableSorting: false});
        $('#ovsbridgeGrid').removeClass('hidden');
        $('#ovsbridge-content-area .wok-mask').addClass('hidden');
      }
    }, function(err) {
        $('#add_ovsbridge_button').prop('disabled',true);
        $('#ovs_search_input').prop('disabled',true);
        $('#ovsbridge-content-area .wok-mask').addClass('hidden');
        wok.message.error(err.responseJSON.reason,'#ovs-alert-container');
    });
}

ginger.initOvsClickHandler = function() {
  $('#add_ovsbridge_button').on('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      wok.window.open('plugins/ginger/host-network-ovs-add.html');
  });
  $('#ovsbridgeGrid').on('click','.edit-bridge',function(e){
      e.preventDefault();
      e.stopPropagation();
      ginger.selectedBridge = $(this).data('name');
      wok.window.open('plugins/ginger/host-network-ovs-edit.html');
  });
  $('#ovsbridgeGrid').on('click','.remove-bridge',function(e){
      e.preventDefault();
      e.stopPropagation();
      ginger.selectedBridge = $(this).data('name');
      var settings = {
          title: i18n['GINNET0048M'],
          content: i18n['GINNET0049M'].replace("%1", '<strong>'+ginger.selectedBridge+'</strong>'),
          confirm: i18n['GINNET0045M'],
          cancel: i18n['GINNET0046M']
      };
      wok.confirm(settings, function() {
          ginger.delOvsBridge(ginger.selectedBridge, function() {
              var bridgeItem = $('div.wok-datagrid-row[data-name="'+ginger.selectedBridge+'"');
              wok.message.success(i18n['GINNET0050M'].replace("%1", '<strong>'+ginger.selectedBridge+'</strong>'),'#ovs-alert-container');
              bridgeItem.remove();
              $('body').animate({ scrollTop: 0 }, 1000);
          }, function(err) {
              wok.message.error(err.responseJSON.reason,'#ovs-alert-container');
              $('body').animate({ scrollTop: 0 }, 1000);
          });
      }, function() {});
  });
}

ginger.addOvsBridgeModal = function(){
  $('#addButton').prop('disabled',true);
  $('input#bridge[name="name"]').on('keyup', function(){
      if($(this).val().length !=0) {
           $('#addButton').prop('disabled', false);
      } else{
           $('#addButton').prop('disabled',true);
      }
  });
  $('#addButton').on('click',function(){
      $('form[name="ovsbridgeadd"]').submit();
  });
  $('form[name="ovsbridgeadd"]').on('submit',function(e){
      e.preventDefault();
      var name = $("#bridge").val();
      var data = {};
      data = {
        name: name
      };
      ginger.addOvsBridge(data, function() {
          $('form[name="ovsbridgeadd"] input').prop('disabled', true);
          $('#addButton').prop('disabled',true);
          ginger.refreshOvsBridges();
          wok.window.close();
          $('body').animate({ scrollTop: 0 }, 1000);
      }, function(err) {
          wok.message.error(err.responseJSON.reason, '#alert-modal-container');
          $('form[name="ovsbridgeadd"] input').prop('disabled', false);
          $('#addButton').prop('disabled',false);
          $("#bridge").focus();
      });
  });
}

ginger.initNetworkConfig = function() {
  ginger.opts_nw_if = {};
  ginger.opts_nw_if['id'] = 'nw-configuration';
  ginger.opts_nw_if['gridId'] = "nwConfigGrid";
  ginger.opts_nw_if['identifier'] = "device";
  ginger.opts_nw_if['loadingMessage'] = i18n['GINNET0025M'];

  ginger.listNetworkConfig();
}

ginger.loadBootgridNWActions = function() {

  var addActionsId = "nw-configuration-add";
  var tabActionsId = "nw-configuration-actions";
  // Add actions for Network Configuration
  var addButton = [{
    id: 'nw-add-bond-button',
    class: 'fa fa-plus-circle',
    label: i18n['GINNET0006M'],
    onClick: function(event) {
      ginger.selectedInterface = null;
      wok.window.open('plugins/ginger/host-network-bond.html');
    }
  }, {
    id: 'nw-add-vlan-button',
    class: 'fa fa-plus-circle',
    label: i18n['GINNET0007M'],
    onClick: function(event) {
      ginger.selectedInterface = null;
      wok.window.open('plugins/ginger/host-network-vlan.html');
    }
  }];

  // Actions for Network Configuration
  var actionButton = [{
    id: 'nw-up-button',
    class: 'fa fa-power-off',
    label: i18n['GINNET0009M'],
    onClick: function(event) {
      var selectedIf = ginger.getSelectedRowsData(ginger.opts_nw_if);
      if ((selectedIf && selectedIf.length == 1) && (selectedIf[0]["status"] == "down")) {
        ginger.showBootgridLoading(ginger.opts_nw_if);
        ginger.enableInterface(selectedIf[0]["device"], "up", function(result) {
          var message = i18n['GINNET0016M'] + " " + selectedIf[0]["device"] + " " + i18n['GINNET0020M'];
          wok.message.success(message, '#message-nw-container-area');
          ginger.getInterfaces(function(result) {
            ginger.hideBootgridLoading(ginger.opts_nw_if);
            ginger.loadBootgridData(ginger.opts_nw_if['gridId'], result);
          }, function(error) {
            ginger.hideBootgridLoading(ginger.opts_nw_if);
          });
        }, function(error) {
          ginger.hideBootgridLoading(ginger.opts_nw_if);
          wok.message.error(error.responseJSON.reason, '#message-nw-container-area', true);
        });
      } else {
        var settings = {
          content: i18n["GINNET0022M"],
          confirm: i18n["GINNET0015M"]
        };
        wok.confirm(settings, function() {});
      }
    }
  }, {
    id: 'nw-down-button',
    class: 'fa fa-ban',
    label: i18n['GINNET0010M'],
    onClick: function(event) {
      var selectedIf = ginger.getSelectedRowsData(ginger.opts_nw_if);
      if ((selectedIf && selectedIf.length == 1) &&
        ((selectedIf[0]["status"] == "up") || (selectedIf[0]["status"] == "unknown"))) {
        ginger.showBootgridLoading(ginger.opts_nw_if);
        ginger.enableInterface(selectedIf[0]["device"], "down", function(result) {
          var message = i18n['GINNET0017M'] + " " + selectedIf[0]["device"] + " " + i18n['GINNET0020M'];
          wok.message.success(message, '#message-nw-container-area');
          ginger.getInterfaces(function(result) {
            ginger.hideBootgridLoading(ginger.opts_nw_if);
            ginger.loadBootgridData(ginger.opts_nw_if['gridId'], result);
          }, function(error) {
            ginger.hideBootgridLoading(ginger.opts_nw_if);
          });
        }, function(error) {
          ginger.hideBootgridLoading(ginger.opts_nw_if);
          var message = i18n['GINNET0017M'] + " " + selectedIf[0]["device"] + " " + i18n['GINNET0021M'];
          wok.message.error(message + " " + error.responseJSON.reason, '#message-nw-container-area', true);
        });
      } else {
        var settings = {
          content: i18n["GINNET0022M"],
          confirm: i18n["GINNET0015M"]
        };
        wok.confirm(settings, function() {});
      }
    }
  }, {
    id: 'nw-restart-button',
    class: 'fa fa-undo',
    label: i18n['GINNET0011M'],
    onClick: function(event) {
      var selectedIf = ginger.getSelectedRowsData(ginger.opts_nw_if);
      if ((selectedIf && selectedIf.length == 1) &&
        ((selectedIf[0]["status"] == "up") || (selectedIf[0]["status"] == "unknown"))) {
        ginger.showBootgridLoading(ginger.opts_nw_if);
        // First Bring down the interface
        ginger.enableInterface(selectedIf[0]["device"], "down", function(result) {
          // Second Bring the interface up back again
          ginger.enableInterface(selectedIf[0]["device"], "up", function(result) {
            var message = i18n['GINNET0018M'] + " " + selectedIf[0]["device"] + " " + i18n['GINNET0020M'];
            wok.message.success(message, '#message-nw-container-area');
            ginger.getInterfaces(function(result) {
              ginger.hideBootgridLoading(ginger.opts_nw_if);
              ginger.loadBootgridData(ginger.opts_nw_if['gridId'], result);
            }, function(error) {
              ginger.hideBootgridLoading(ginger.opts_nw_if);
            });
          }, function(error) {
            ginger.hideBootgridLoading(ginger.opts_nw_if);
            var message = i18n['GINNET0018M'] + " " + selectedIf[0]["device"] + " " + i18n['GINNET0021M'];
            wok.message.error(message + " " + error.responseJSON.reason, '#message-nw-container-area', true);
          });
        }, function(error) {
          ginger.hideBootgridLoading(ginger.opts_nw_if);
          var message = "Failed to brought down the interface " + selectedIf[0]["device"];
          wok.message.error(message + " " + error.responseJSON.reason, '#message-nw-container-area', true);
        });
      } else if (selectedIf && selectedIf.length == 1 && (selectedIf[0]["status"] == "down")) {
        ginger.showBootgridLoading(ginger.opts_nw_if);
        // Assuming interface is down already and just needs to brought up
        ginger.enableInterface(selectedIf[0]["device"], "up", function(result) {
          var message = i18n['GINNET0018M'] + " " + selectedIf[0]["device"] + " " + i18n['GINNET0020M'];
          wok.message.success(message, '#message-nw-container-area');
          ginger.getInterfaces(function(result) {
            ginger.hideBootgridLoading(ginger.opts_nw_if);
            ginger.loadBootgridData(ginger.opts_nw_if['gridId'], result);
          }, function(error) {
            ginger.hideBootgridLoading(ginger.opts_nw_if);
          });
        }, function(error) {
          ginger.hideBootgridLoading(ginger.opts_nw_if);
          var message = i18n['GINNET0018M'] + " " + selectedIf[0]["device"] + " " + i18n['GINNET0021M'];
          wok.message.error(message + " " + error.responseJSON.reason, '#message-nw-container-area', true);
        });
      } else {
        var settings = {
          content: i18n["GINNET0022M"],
          confirm: i18n["GINNET0015M"]
        };
        wok.confirm(settings, function() {});
      }
    }
  }, {
    id: 'nw-settings-button',
    class: 'fa fa-cog',
    label: i18n['GINNET0012M'],
    onClick: function(event) {
      var selectedIf = ginger.getSelectedRowsData(ginger.opts_nw_if);
      if (selectedIf && (selectedIf.length == 1)) {
        ginger.selectedInterface = (selectedIf[0]["device"] == "undefined" ? null : selectedIf[0]["device"]);
        ginger.retrieveCfgInterface(ginger.selectedInterface, function (result) {
            if ((selectedIf[0]["type"]).toLowerCase() == "vlan") {
              wok.window.open('plugins/ginger/host-network-vlan.html');
            } else if ((selectedIf[0]["type"]).toLowerCase() == "bonding") {
              wok.window.open('plugins/ginger/host-network-bond.html');
            } else if (((selectedIf[0]["type"]).toLowerCase() == "ethernet") || ((selectedIf[0]["type"]).toLowerCase() == "nic")) {
              // condition nic should go away if #104 to be correct and resolved
              wok.window.open('plugins/ginger/host-network-settings.html');
            }
        }, function(error){
            wok.message.error(i18n['GINNET0034E'].replace("%1", ginger.selectedInterface), '#message-nw-container-area', true);
            //Re-load the network interfaces after to clear other inactive interfaces without ifcfg files
            ginger.initNetworkConfigGridData();
        });
      } else {
        var settings = {
          content: i18n["GINNET0022M"],
          confirm: i18n["GINNET0015M"]
        };
        wok.confirm(settings, function() {});
      }
    }
  },{
    id: 'nw-enable-sriov',
    class: 'fa fa-minus-circle',
    label: i18n['GINNET0037E'],
    onClick: function(event) {
      var selectedIf = ginger.getSelectedRowsData(ginger.opts_nw_if);
      ginger.selectedInterface = selectedIf[0];
      wok.window.open('plugins/ginger/host-network-enable-sriov.html');
    }
  },{
    id: 'nw-delete-button',
    class: 'fa fa-minus-circle',
    label: i18n['GINNET0013M'],
    critical: true,
    onClick: function(event) {
      var selectedIf = ginger.getSelectedRowsData(ginger.opts_nw_if);
      if (selectedIf && (selectedIf.length == 1) && (selectedIf[0]["type"]).toLowerCase() != 'nic') {
        ginger.selectedNWInterface = selectedIf[0]["device"];
          var settings = {
            content: i18n['GINNET0028M'].replace("%1", ginger.selectedNWInterface),
            confirm: i18n["GINNET0015M"]
          };
          wok.confirm(settings, function() {
            ginger.showBootgridLoading(ginger.opts_nw_if);
            ginger.deleteInterface(ginger.selectedNWInterface, function(result) {
              var message = i18n['GINNET0019M'] + " " + ginger.selectedNWInterface + " " + i18n['GINNET0020M'];
              wok.message.success(message, '#message-nw-container-area');

              //Re-load the network interfaces after delete action
              ginger.getInterfaces(function(result) {
                ginger.hideBootgridLoading(ginger.opts_nw_if);
                ginger.loadBootgridData(ginger.opts_nw_if['gridId'], result);
              }, function(error) {
                ginger.hideBootgridLoading(ginger.opts_nw_if);
              });
            }, function(error) {
              ginger.hideBootgridLoading(ginger.opts_nw_if);
              var message = i18n['GINNET0019M'] + " " + ginger.selectedNWInterface + " " + i18n['GINNET0021M'];
              wok.message.error(message + " " + error.responseJSON.reason, '#message-nw-container-area', true);
            });
          }, function() {
            ginger.hideBootgridLoading(ginger.opts_nw_if);
          });
      } else if (selectedIf.length > 1) {
        var settings = {
          content: i18n["GINNET0022M"],
          confirm: i18n["GINNET0015M"]
        };
        wok.confirm(settings, function() {});
      }
    }
  }];

  ginger.opts_nw_if['addButtons'] = JSON.stringify(addButton);
  ginger.opts_nw_if['actions'] = JSON.stringify(actionButton);

  var addListSettings = {
    panelID: addActionsId,
    buttons: addButton,
    type: 'add'
  };

  var actionListSettings = {
    panelID: tabActionsId,
    buttons: actionButton,
    type: 'action'
  };

  ginger.createActionList(addListSettings);

  // Hide button "Add VLAN" and "Add BOND "in case of capability "cfginterfaces" false
  if (ginger.cfginterfaces != undefined && !ginger.cfginterfaces) {
    $('#nw-add-bond-button').hide();
    $('#nw-add-vlan-button').hide();
    $('#nw-configuration-add').hide();
  } else {
    $('#nw-add-bond-button').show();
    $('#nw-add-vlan-button').show();
    $('#nw-configuration-add').show();
  }

  ginger.createActionList(actionListSettings);

  $("#nw-configuration-refresh-btn").on('click', function() {
	  ginger.networkConfiguration.disableAllButtons();
	  ginger.initNetworkConfigGridData();
  });
  ginger.networkConfiguration.disableActions();
}

ginger.listNetworkConfig = function() {

  var nwGrid = [];
  var gridFields = [];

  ginger.loadBootgridNWActions();
  //Network Configuration grid columns
  gridFields = [{
      "column-id": 'status',
      "type": 'string',
      "width": "5%",
      "formatter": "nw-interface-status",
      "title": ""
    }, {
      "column-id": 'device',
      "type": 'string',
      "width": "15%",
      "identifier": true,
      "title": i18n['GINNET0001M']
    }, {
      "column-id": 'type',
      "type": 'string',
      "width": "5%",
      "title": i18n['GINNET0003M']
    }, {
      "column-id": 'nic_type',
      "type": 'string',
      "width": "10%",
      "title": i18n['GINNET0062M']
    }, {
      "column-id": 'ipaddr',
      "formatter": "nw-address-space",
      "type": 'string',
      "width": "20%",
      "title": i18n['GINNET0004M']
    },
    {
      "column-id": 'rdma_enabled',
      "type": 'string',
      "width": "10%",
      "title": i18n['GINNET0039E']
    },
    {
      "column-id": 'module',
      "type": 'string',
      "width": "10%",
      "title": i18n['GINNET0036E']
    },
    {
      "column-id": 'macaddr',
      "type": 'string',
      "width": "20%",
      "title": i18n['GINNET0005M']
    }
  ];

  ginger.opts_nw_if['gridFields'] = JSON.stringify(gridFields);

  nwGrid = ginger.createBootgrid(ginger.opts_nw_if);
  ginger.hideBootgridLoading(ginger.opts_nw_if);

  nwGrid.bootgrid().on("selected.rs.jquery.bootgrid", function(e, rows) {
    changeActionButtonsState();
  }).on("deselected.rs.jquery.bootgrid", function(e, rows) {
    changeActionButtonsState();
  }).on("loaded.rs.jquery.bootgrid", function(e, rows) {
    changeActionButtonsState();
  });

  var changeActionButtonsState = function() {
    // By default enable them all
    ginger.changeButtonStatus(["nw-up-button", "nw-down-button", "nw-restart-button",
      "nw-settings-button", "nw-delete-button", "nw-enable-sriov"
    ], true);
    // Based on the interface status hide/show the right buttons
    var selectedIf = ginger.getSelectedRowsData(ginger.opts_nw_if);
    if (selectedIf && selectedIf.length == 1) {
      ginger.networkConfiguration.enableActions();
      if (selectedIf && (selectedIf[0]["status"] == 'up' || selectedIf[0]["status"] == 'unknown')) {
        ginger.changeButtonStatus(["nw-up-button"], false);
      } else {
        ginger.changeButtonStatus(["nw-down-button"], false);
      }
      if ((selectedIf[0]["module"] != 'mlx5_core' && selectedIf[0]["module"] != 'mlx5-core') || (selectedIf[0]["nic_type"] === 'virtual' )) {
        ginger.changeButtonStatus(["nw-enable-sriov"], false);
      }
      if ((selectedIf[0]["type"]).toLowerCase() == 'nic') {
        ginger.changeButtonStatus(["nw-delete-button"], false);
      }
    }
    else{
       ginger.networkConfiguration.disableActions();
    }
    //hide or show settings button based on cfginterfaces value
    ginger.changeButtonStatus(["nw-settings-button"], ginger.cfginterfaces);
  };
  ginger.initNetworkConfigGridData();
};

ginger.initNetworkConfigGridData = function() {
  ginger.clearBootgridData(ginger.opts_nw_if['gridId']);
  ginger.hideBootgridData(ginger.opts_nw_if);
  ginger.showBootgridLoading(ginger.opts_nw_if);

  ginger.getInterfaces(function(result) {

    $.each(result, function(index, value){
        if(value.rdma_enabled) {
          value.rdma_enabled = 'Yes';
        } else {
          value.rdma_enabled = 'No';
        }
    });

    ginger.loadBootgridData(ginger.opts_nw_if['gridId'], result);
    ginger.showBootgridData(ginger.opts_nw_if);
    ginger.hideBootgridLoading(ginger.opts_nw_if);
    ginger.networkConfiguration.enableAllButtons();
  }, function(error) {
    var errmessage = i18n['GINNET0033E'];
    wok.message.error(errmessage + " " + error.responseJSON.reason, '#message-nw-container-area', true);
    ginger.hideBootgridLoading(ginger.opts_nw_if);
    ginger.networkConfiguration.enableAllButtons();
    });
};

ginger.loadGlobalNetworkConfig = function() {
    var globalNetworkConfigTable;
    var dataSet = new Array();

    var loadGlobalNetworkConfigDatatable = function(dataSet) {
        globalNetworkConfigTable = $('#global-network').DataTable({
            "processing": true,
            "data": dataSet,
            "bSort": false,
            "dom": 't',
            "scrollY": "234px",
            "columns": [{
                title: "DNS",
                className: 'col-sm-2',
                render: function(r, t, data, meta) {
                    if (data[0] !== 'add-new-dns') {
                        return '<span class="dns-readonly">' + data + '</span>' +
                            '<span class="dns-edit hidden">' +
                            '<label for="dns-input-' + meta.row + '"><span class="sr-only">DNS:</span>' +
                            '<input type="text" value="' + data + '" name="dns-edit[]" id="dns-input-' + meta.row + '" class="form-control" readonly="readonly">' +
                            '</label>' +
                            '</span>'
                    } else {
                        return '<span class="dns-add-readonly">&nbsp;</span>' +
                            '<span class="dns-add-edit hidden">' +
                            '<label for="dns-input-' + meta.row + '"><span class="sr-only">DNS:</span>' +
                            '<input type="text" value="" name="dns-add" id="dns-input-' + meta.row + '" class="form-control" readonly="readonly">' +
                            '</label>' +
                            '</span>'
                    }
                }
            }, {
                title: "Actions",
                render: function(r, t, data, meta) {
                    if (data[0] !== 'add-new-dns') {
                        return '<span class="column-dns-actions">' +
                            '<span class="readonly-dns-actions">' +
                            '<button class="btn btn-link edit-dns btn-xs">' +
                            '<i role="presentation" class="fa fa-pencil"></i> <span>' + i18n['GINNET0074M'] + '</span>' +
                            '</button>' +
                            '<button class="btn btn-link remove-dns btn-xs">' +
                            '<i role="presentation" class="fa fa-trash-o"></i> <span>' + i18n['GINNET0064M'] + '</span>' +
                            '</button>' +
                            '</span>' +
                            '<span class="editable-dns-actions hidden">' +
                            '<button class="btn btn-primary save-dns btn-xs">' + i18n['GINNET0065M'] + '</button>' +
                            '<button class="btn btn-primary cancel-dns btn-xs">' + i18n['GINNET0066M'] + '</button>' +
                            '</span>' +
                            '</span>'
                    } else {
                        return '<span class="column-dns-actions">' +
                            '<span class="readonly-dns-add-actions">' +
                            '<button class="btn btn-primary add-dns btn-xs">' +
                            '<i role="presentation" class="fa fa-plus-circle"></i> <span>' + i18n['GINNET0067M'] + '</span>' +
                            '</button>' +
                            '</span>' +
                            '<span class="editable-dns-add-actions hidden">' +
                            '<button class="btn btn-primary save-add-dns btn-xs" disabled="disabled">' + i18n['GINNET0065M'] + '</button>' +
                            '<button class="btn btn-primary cancel-add-dns btn-xs">' + i18n['GINNET0066M'] + '</button>' +
                            '</span>' +
                            '</span>'
                    }
                }
            }],
            createdRow: function(row, data, dataIndex) {
                $(row).find('td:eq(0)').parent().attr('data-dns', data[0]); // This ensures that the data attribute will always get the first position in the datatables' data array
            }
        });
        $(globalNetworkConfigTable.column('1').header()).wrapInner('<span class="sr-only"></span>');
        $('#network-global-configuration-content-area > .wok-mask').addClass('hidden');
        tableAdd();
    };

    var tableAdd = function() {
        globalNetworkConfigTable.row.add(['add-new-dns']).draw(false);
    };
    var tableClickHandler = function() {
        $('#network-global-configuration-content-area').on('click', '.edit-dns', function(e) {
            var row = $(this).parents('tr');
            var complete = function() {
                row.find('.readonly-dns-actions').addClass('hidden');
                row.find('.editable-dns-actions').removeClass('hidden');
                row.find('.dns-readonly').addClass('hidden');
                row.find('.dns-edit').removeClass('hidden');
                row.find('input').prop('readonly', false);
            }
            var toggleEdit = function() {
                if ($(row.parent()).find('.editable-dns-actions').not('.hidden').length) {
                    $(row.parent()).find('.editable-dns-actions').not('.hidden').each(function() {
                        if (!$(this).parents('tr').find('label.has-error').length) {
                            wok.confirm({
                                title: i18n['GINNET0068M'],
                                content: i18n['GINNET0069M'],
                                confirm: i18n['GINNET0072M'],
                                cancel: i18n['GINNET0073M']
                            }, function() {
                                $(row.parent()).find('tr').not(row).each(function() {
                                    $('.save-dns', this).trigger('click');
                                });
                                complete();
                            }, function() {
                                $(row.parent()).find('tr').not(row).each(function() {
                                    $('.cancel-dns', this).trigger('click');
                                });
                                complete();
                            });
                        } else {
                            complete();
                        }
                    });
                } else {
                    complete();
                }
            };
            var toggleSave = function() {
                $(row.parent()).find('.editable-dns-add-actions').not('.hidden').each(function() {
                    if (!$(this).parents('tr').find('label.has-error').length) {
                        wok.confirm({
                            title: i18n['GINNET0068M'],
                            content: i18n['GINNET0069M'],
                            confirm: i18n['GINNET0072M'],
                            cancel: i18n['GINNET0073M']
                        }, function() {
                            $(row.parent()).find('tr').not(row).each(function() {
                                $('.save-add-dns', this).trigger('click');
                            });
                            complete();
                        }, function() {
                            $(row.parent()).find('tr').not(row).each(function() {
                                $('.cancel-add-dns', this).trigger('click');
                            });
                            complete();
                        });
                    } else {
                        wok.confirm({
                            title: i18n['GINNET0070M'],
                            content: i18n['GINNET0071M'],
                            confirm: i18n['GINNET0074M'],
                            cancel: i18n['GINNET0073M']
                        }, function() {
                            $('label.has-error input', row.parent()).focus();
                        }, function() {
                            $('.cancel-add-dns', row.parent()).trigger('click');
                            complete();
                        });
                    }
                });
            };

            if ($(row.parent()).find('.dns-add-edit').not('.hidden').length) {
                if ($(row.parent()).find('.dns-add-edit input').val().length) {
                    toggleSave();
                } else {
                    $('.cancel-add-dns', row.parent()).trigger('click');
                    toggleEdit();
                }
            } else {
                toggleEdit();
            }
        });

        $('#network-global-configuration-content-area').on('click', '.save-dns', function(e) {
            var row = $(this).parents('tr');
            var cell = $(this).parents('tr').find('td:eq(0)');
            var newDns = cell.find('span > label > input').val();
            globalNetworkConfigTable.cell(cell).data(newDns);
            globalNetworkConfigTable.row(row).invalidate().draw();
        });
        $('#network-global-configuration-content-area').on('click', '.cancel-dns', function(e) {
            var row = $(this).parents('tr');
            globalNetworkConfigTable.row(row).invalidate().draw();
        });
        $('#network-global-configuration-content-area').on('click', '.remove-dns', function(e) {
            globalNetworkConfigTable.row($(this).parents('tr')).remove().draw();
        });
        $('#network-global-configuration-content-area').on('click', '.add-dns', function(e) {
            var row = $(this).parents('tr');
            $(row.parent()).find('tr').not(row).each(function() {
                $('.cancel-dns', this).trigger('click');
            });
            $(this).parents('.column-dns-actions').find('.readonly-dns-add-actions').addClass('hidden');
            $(this).parents('.column-dns-actions').find('.editable-dns-add-actions').removeClass('hidden');
            $(this).parents('tr').find('.dns-add-readonly').addClass('hidden');
            $(this).parents('tr').find('.dns-add-edit').removeClass('hidden');
            $(this).parents('tr').find('input').prop('readonly', false);
        });
        $('#network-global-configuration-content-area').on('click', '.save-add-dns', function(e) {
            var row = $(this).parents('tr');
            var cell = $(this).parents('tr').find('td:eq(0)');
            var newDns = cell.find('span > label > input').val();
            globalNetworkConfigTable.row($(this).parents('tr')).remove().draw();
            globalNetworkConfigTable.row.add([newDns]).draw();
            tableAdd();
        });
        $('#network-global-configuration-content-area').on('click', '.cancel-add-dns', function(e) {
            var row = $(this).parents('tr');
            var staticRowsLength = globalNetworkConfigTable.columns(0).data().eq(0).sort().length;
            var uniqueRowsLength = globalNetworkConfigTable.columns(0).data().eq(0).sort().unique().length;
            if (staticRowsLength > uniqueRowsLength) {
                globalNetworkConfigTable.row($(this).parents('tr')).remove().draw();
            } else {
                globalNetworkConfigTable.row(row).invalidate().draw();
            }
        });

        $('#network-global-configuration-content-area').on('click', '#nw-global-config-refresh-btn', function(e) {
            $('#network-global-configuration-content-area > .wok-mask').removeClass('hidden');
            globalNetworkConfigTable.destroy();
            getNetworkGlobalConfiguration('refresh');
            loadGlobalNetworkConfigDatatable(dataSet);
        });

        $('#network-global-configuration-content-area').on('click', '#nw-global-config-apply-btn', function(e) {
            var global_info = {};
            var globalDnsAddresses;
            var globalDnsGateway = $('#global-network-config-gateway');
            var applyData = function() {
                globalDnsAddresses = globalNetworkConfigTable.columns(0).data().eq(0).unique();
                globalDnsAddresses.pop(); // it removes the last empy row from the 1d array
                if (globalDnsAddresses.length > 0) {
                    dns = []
                    for (var i = 0; i < globalDnsAddresses.length; i++) {
                        dnsValue = globalDnsAddresses[i];
                        dns.push(dnsValue);
                    }
                    global_info['nameservers'] = dns;
                } else {
                    global_info['nameservers'] = '[]'
                }
                if (globalDnsGateway.val() != "") {
                    global_info['gateway'] = globalDnsGateway.val();
                }
                $('#network-global-configuration-content-area > .wok-mask').removeClass('hidden');
                ginger.updateNetworkGlobals(global_info, function(result) {
                    var message = i18n['GINNET0024M'] + " " + i18n['GINNET0020M'];
                    globalNetworkConfigTable.destroy();
                    getNetworkGlobalConfiguration();
                    wok.message.success(message, '#message-nw-global-container-area');
                    $('#network-global-configuration-content-area > .wok-mask').addClass('hidden');
                }, function(error) {
                    $('#network-global-configuration-content-area > .wok-mask').addClass('hidden');
                    var message = i18n['GINNET0024M'] + " " + i18n['GINNET0021M'] + " " + error.responseJSON.reason;
                    wok.message.error(error.responseJSON.reason, '#message-nw-global-container-area', true);
                });
            }

            if ($('.dns-edit, .dns-add-edit').not('.hidden').length) {
                wok.confirm({
                    title: i18n['GINNET0068M'],
                    content: i18n['GINNET0076M'],
                    confirm: i18n['GINNET0075M'],
                    cancel: i18n['GINNET0073M']
                }, function() {
                    applyData();
                }, null);
            } else {
                applyData();
            }
        });
    }
    tableClickHandler();

    var tableInputValidation = function() {
        $('#global-network').on('keyup', 'input[type="text"]', function(e) {
            var row = $(this).parents('tr');
            var currInput = $(this).val();
            var inputs = new Array();
            // This will make sure that if the user has typed an IP address but not saved it, it will prevent typing the same value in another input:
            $('#global-network input[type="text"]').not(this).each(function() {
                inputs.push($(this).val());
            });
            if (_.includes(inputs, currInput)) {
                $(this).parent().addClass('has-error');
                $(row).find('.save-add-dns,.save-dns').prop('disabled', true);
            } else {
                $(this).parent().removeClass('has-error');
                $(row).find('.save-add-dns,.save-dns').prop('disabled', false);
            }
        });
    }
    tableInputValidation();

    var gatewayInputValidation = function() {
        $('#global-network-config-gateway').on('keyup', function(e) {
          var gatewayIP = $('#global-network-config-gateway').val();

          if(gatewayIP.trim() == "") {
            $(this).parent().toggleClass('has-error',true);
            $('#nw-global-config-apply-btn').prop('disabled', true);
          } else {
            $(this).parent().toggleClass("has-error", !((ginger.isValidIPv6(gatewayIP)) || ginger.validateIp(gatewayIP)));
            $('#nw-global-config-apply-btn').prop('disabled', !((ginger.isValidIPv6(gatewayIP)) || ginger.validateIp(gatewayIP)));
          }
        });
    }
    gatewayInputValidation();

    var getNetworkGlobalConfiguration = function(callback) {
        ginger.getNetworkGlobals(function(dnsAddresses) {
            if ("nameservers" in (dnsAddresses)) {
                dataSet.length = 0;
                var DNSNameServers = dnsAddresses.nameservers
                for (var i = 0; i < DNSNameServers.length; i++) {
                    dataSet.push([DNSNameServers[i]]);
                }
            }
            if ("gateway" in (dnsAddresses)) {
                $('#global-network-config-gateway').val(dnsAddresses.gateway);
            }
            if (callback !== 'refresh') {
                loadGlobalNetworkConfigDatatable(dataSet);
            }
        }, function(error) {
            errmsg = i18n['GINNET0035E'] + ' ' + error.responseJSON.reason;
            wok.message.error(errmsg, '#message-nw-global-container-area', true);
        });
    }
    getNetworkGlobalConfiguration();
};


ginger.initNetwork = function() {
  $(".content-area", "#gingerHostNetwork").css("height", "100%");
  ginger.getHostDetails(function(result) {
    ginger.hostarch = result["architecture"];
    ginger.getCapabilities(function(result) {
      $.each(result, function(enableItem, capability) {
        var itemLowCase = enableItem.toLowerCase();
        switch (itemLowCase) {
          case "network":
            ginger.initNetworkConfig();
            ginger.loadGlobalNetworkConfig();
            break;
          case "cfginterfaces":
            ginger.cfginterfaces = capability;
            ginger.changeButtonStatus(["nw-add-bond-button", "nw-add-vlan-button", "nw-configuration-add"], capability);
            break;
          case "ovsbridges":
            ginger.ovsbridges = capability;
            ginger.initOvsBridges();
            break;
        }
      });
    });
  });
};

ginger.networkConfiguration = {};

ginger.networkConfiguration.enableAllButtons = function(){
	ginger.networkConfiguration.enableActions();
	ginger.networkConfiguration.enableRefresh();
	ginger.networkConfiguration.enableAdd();
}

ginger.networkConfiguration.disableAllButtons = function(){
	ginger.networkConfiguration.disableActions();
	ginger.networkConfiguration.disableRefresh();
	ginger.networkConfiguration.disableAdd();
}

ginger.networkConfiguration.enableActions = function (){
	$("#action-dropdown-button-nw-configuration-actions").prop("disabled", false);
};

ginger.networkConfiguration.disableActions = function (){
	$("#action-dropdown-button-nw-configuration-actions").parent().removeClass('open');
	$("#action-dropdown-button-nw-configuration-actions").prop("disabled", true);
};

ginger.networkConfiguration.enableRefresh = function (){
	$("#nw-configuration-refresh-btn").prop("disabled", false);
};

ginger.networkConfiguration.disableRefresh = function (){
	$("#nw-configuration-refresh-btn").prop("disabled", true);
};
ginger.networkConfiguration.enableAdd = function (){
	$("#action-dropdown-button-nw-configuration-add").prop("disabled", false);
};

ginger.networkConfiguration.disableAdd = function (){
	$("#action-dropdown-button-nw-configuration-add").prop("disabled", true);
};
