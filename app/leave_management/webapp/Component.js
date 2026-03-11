sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
    "use strict";
    return UIComponent.extend("leavemanagement.Component", {
        metadata: { manifest: "json" },
        init: function () {
            // 1. Initialize the Session Model FIRST
            var oSessionModel = new JSONModel({
                id: "",
                name: "",
                role: "",
                isLoggedIn: false,
                annualBalance: 18, 
                sickUsed: 2
            });
            this.setModel(oSessionModel, "userSession");

            // 2. Call parent init (starts routing)
            UIComponent.prototype.init.apply(this, arguments);
            this.getRouter().initialize();

            // 3. Security Guard
            this.getRouter().attachRouteMatched(function (oEvent) {
                var sRoute = oEvent.getParameter("name");
                var bLoggedIn = this.getModel("userSession").getProperty("/isLoggedIn");
                
                if (!bLoggedIn && sRoute !== "RouteLogin") {
                    this.getRouter().navTo("RouteLogin");
                }
            }, this);
        }
    });
});