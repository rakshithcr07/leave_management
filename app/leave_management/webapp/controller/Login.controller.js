sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("leavemanagement.controller.Login", {
        onLoginEmployee: function () {
            var oSession = this.getOwnerComponent().getModel("userSession");
            var sAshaId = "0e0acb21-2e22-4d3a-8f7a-2b7b4c2b1a11"; 
            
            // USE setProperty to update ONLY specific fields
            // This prevents annualBalance from being deleted
            oSession.setProperty("/id", sAshaId);
            oSession.setProperty("/name", "Asha Kumar");
            oSession.setProperty("/role", "Employee");
            oSession.setProperty("/isLoggedIn", true);

            this.getOwnerComponent().getRouter().navTo("RouteEmployee", {
                employeeId: sAshaId
            });
        },

        onLoginManager: function () {
            var oSession = this.getOwnerComponent().getModel("userSession");
            
            oSession.setProperty("/id", "3f0b6d41-5f5d-4d93-9f58-69c3a0a0c3b1");
            oSession.setProperty("/name", "Manager One");
            oSession.setProperty("/role", "Manager");
            oSession.setProperty("/isLoggedIn", true);

            this.getOwnerComponent().getRouter().navTo("RouteManager");
        }
    });
});