sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment"
], function (Controller, MessageBox, MessageToast, Filter, FilterOperator, Fragment) {
    "use strict";

    return Controller.extend("leavemanagement.controller.EmployeeDashboard", {
        
        onInit: function () {
            // Pattern matched triggers every time the user navigates to this page
            this.getOwnerComponent().getRouter().getRoute("RouteEmployee").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function() {
            // Get ID dynamically from the Global Session Model we created in Component.js
            var oSession = this.getOwnerComponent().getModel("userSession");
            this._sUserId = oSession.getProperty("/id");

            if (!this._sUserId) {
                // If no ID exists (e.g. manual URL type), Route Guard will handle it, 
                // but we stop execution here for safety.
                return;
            }

            this._applyFilters();
        },

        _applyFilters: function() {
            var oTable = this.byId("idEmpHistoryTable");
            var oBinding = oTable.getBinding("items");
            if (oBinding) {
                // Filter table by the logged-in user
                oBinding.filter(new Filter("employee_ID", FilterOperator.EQ, this._sUserId));
            }
        },

        onOpenRequestDialog: function () {
            if (!this._pDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "leavemanagement.view.fragments.CreateRequest",
                    controller: this
                }).then(oDialog => {
                    this._pDialog = oDialog;
                    this.getView().addDependent(this._pDialog);
                    this._pDialog.open();
                });
            } else {
                this._pDialog.open();
            }
        },

        onDateChange: function() {
            const oStart = this.byId("idStart").getDateValue();
            const oEnd = this.byId("idEnd").getDateValue();
            const oTypeSelect = this.byId("idTypeSelect");

            if (oStart && oEnd) {
                if (oEnd < oStart) {
                    this.byId("idEnd").setValueState("Error");
                    this.byId("idTotalDays").setValue("0");
                    return;
                }
                
                const iDays = Math.ceil(Math.abs(oEnd - oStart) / (1000 * 60 * 60 * 24)) + 1;
                this.byId("idEnd").setValueState("None");
                this.byId("idTotalDays").setValue(iDays);

                // Sick Leave Logic
                const sTypeName = oTypeSelect.getSelectedItem().getText();
                const bIsSick = sTypeName.toLowerCase().includes("sick");
                const bNeedsDoc = (bIsSick && iDays > 2);
                
                this.byId("idLabelAttachment").setVisible(bNeedsDoc);
                this.byId("idFileUploader").setVisible(bNeedsDoc);
            }
        },

        onSaveRequest: function() {
            const oModel = this.getView().getModel();
            const oTable = this.byId("idEmpHistoryTable");
            const oBinding = oTable.getBinding("items");
            
            const iDays = parseInt(this.byId("idTotalDays").getValue());
            const sTypeName = this.byId("idTypeSelect").getSelectedItem().getText();
            const oFile = this.byId("idFileUploader");

            if (sTypeName.toLowerCase().includes("sick") && iDays > 2 && !oFile.getValue()) {
                MessageBox.error("A Medical Certificate is mandatory for Sick Leave exceeding 2 days.");
                return;
            }

            // Create Request
            const oNewContext = oBinding.create({
                "employee_ID": this._sUserId,
                "manager_ID": "3f0b6d41-5f5d-4d93-9f58-69c3a0a0c3b1",
                "leaveType_ID": this.byId("idTypeSelect").getSelectedKey(),
                "startDate": this.byId("idStart").getDateValue().toISOString().split('T')[0],
                "endDate": this.byId("idEnd").getDateValue().toISOString().split('T')[0],
                "days": iDays,
                "status": "Pending"
            });

            oModel.submitBatch("leaveUpdateGroup").then(() => {
                MessageToast.show("Leave Request Submitted Successfully");
                this.onCloseDialog();
                // Refresh binding to show updated data
                oBinding.refresh();
            }).catch(err => MessageBox.error(err.message));
        },

        onCloseDialog: function() {
            if (this._pDialog) {
                this._pDialog.close();
                // Reset inputs
                this.byId("idStart").setValue("");
                this.byId("idEnd").setValue("");
                this.byId("idTotalDays").setValue("0");
                this.byId("idTypeSelect").setSelectedKey(null);
            }
        },
      onDeleteRequest: function (oEvent) {
    var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
    var oContext = oEvent.getSource().getBindingContext();

    sap.m.MessageBox.confirm("Are you sure you want to delete this pending request?", {
        title: "Confirm Deletion",
        onClose: function (sAction) {
            if (sAction === "OK") {
                // Delete from OData V4 source
                oContext.delete().then(function () {
                    sap.m.MessageToast.show("Request deleted successfully");
                }.bind(this)).catch(function (oError) {
                    sap.m.MessageBox.error("Could not delete: " + oError.message);
                });
            }
        }.bind(this)
    });
}
    });
});