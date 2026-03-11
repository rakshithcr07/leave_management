sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast"
], function (Controller, Fragment, MessageToast) {
    "use strict";

    return Controller.extend("leavemanagement.controller.App", {
        
        /**
         * Navigates to Employee Dashboard using the ID stored in session
         */
        onNavToEmployee: function () {
            var sId = this.getOwnerComponent().getModel("userSession").getProperty("/id");
            this.getOwnerComponent().getRouter().navTo("RouteEmployee", { 
                employeeId: sId 
            });
        },

        /**
         * Navigates to Manager Workspace
         */
        onNavToManager: function () {
            this.getOwnerComponent().getRouter().navTo("RouteManager");
        },

        /**
         * Clears user session and kicks user back to Login
         */
        onLogout: function () {
            var oSessionModel = this.getOwnerComponent().getModel("userSession");
            
            // 1. Reset Session Data
            oSessionModel.setData({
                id: "",
                name: "",
                role: "",
                isLoggedIn: false,
                annualBalance: 0
            });

            // 2. Navigation
            MessageToast.show("Logged out successfully");
            this.getOwnerComponent().getRouter().navTo("RouteLogin");
        },

        /**
         * Opens the User Profile Fragment
         */
        onShowUserProfile: function (oEvent) {
            var oButton = oEvent.getSource();
            if (!this._pProfilePopover) {
                this._pProfilePopover = Fragment.load({
                    id: this.getView().getId(),
                    name: "leavemanagement.view.fragments.UserProfile",
                    controller: this
                }).then(oPopover => {
                    this.getView().addDependent(oPopover);
                    return oPopover;
                });
            }
            this._pProfilePopover.then(oPopover => oPopover.openBy(oButton));
        }
    });
});