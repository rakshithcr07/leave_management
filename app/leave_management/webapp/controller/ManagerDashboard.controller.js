sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("leavemanagement.controller.ManagerDashboard", {
        onInit: function () {
            // Re-run logic every time the manager enters this view
            this.getOwnerComponent().getRouter().getRoute("RouteManager").attachPatternMatched(this._onMatched, this);
        },

        _onMatched: function() {
            var oSession = this.getOwnerComponent().getModel("userSession");
            var sManagerId = oSession.getProperty("/id");
            
            var oTable = this.byId("idMgrApprovalTable");
            var oBinding = oTable.getBinding("items");

            if (oBinding) {
                // 1. Refresh the data to get the latest employee submissions
                oBinding.refresh();
                
                // 2. Filter the table to only show requests assigned to THIS manager
                var oFilter = new Filter("manager_ID", FilterOperator.EQ, sManagerId);
                oBinding.filter([oFilter]);
            }
        },

       onApprove: function (oEvent) {
    var oContext = oEvent.getSource().getBindingContext();
    var iDays = oContext.getProperty("days");
    var sType = oContext.getProperty("leaveType/name"); // Expanded from your XML

    // 1. Update status to Approved
    oContext.setProperty("status", "Approved");

    // 2. Logic: If it's Annual Leave, subtract from the session balance
    if (sType && sType.includes("Annual")) {
        var oSession = this.getOwnerComponent().getModel("userSession");
        var iCurrent = oSession.getProperty("/annualBalance");
        
        // Update the model - this reflects in the Employee's tile immediately
        oSession.setProperty("/annualBalance", iCurrent - iDays);

        // Inside Manager's onApprove function
var iNewBalance = iCurrentBalance - iDaysRequested;
oSession.setProperty("/annualBalance", iNewBalance);
    }

    // 3. Save to Backend
    this.getView().getModel().submitBatch("leaveUpdateGroup").then(function() {
        sap.m.MessageToast.show("Approved. Employee balance updated.");
    });
},
        onReject: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            oContext.setProperty("status", "Rejected");
            this._save("Leave request has been rejected");
        },

        /**
         * Triggers the batch submission defined in manifest.json (leaveUpdateGroup)
         */
        _save: function(sMsg) {
            var oModel = this.getView().getModel();
            
            oModel.submitBatch("leaveUpdateGroup").then(function() {
                MessageToast.show(sMsg);
            }).catch(function(oError) {
                sap.m.MessageBox.error("Error saving changes: " + oError.message);
            });
        },
        onApprove: function (oEvent) {
    var oContext = oEvent.getSource().getBindingContext();
    var iDays = oContext.getProperty("days");
    var sType = oContext.getProperty("type"); // e.g., "Annual Leave" or "Sick Leave"

    // 1. Set status to Approved
    oContext.setProperty("status", "Approved");

    // 2. Business Logic: Subtract days if it's Annual Leave
    // (Note: In a real app, this happens on the Backend/CAP, but we can simulate it here)
    if (sType.includes("Annual")) {
        var oSession = this.getOwnerComponent().getModel("userSession");
        var iCurrentBalance = oSession.getProperty("/annualBalance");
        oSession.setProperty("/annualBalance", iCurrentBalance - iDays);
    }

    this._save("Leave Approved and Balance Updated");
}
    });
});