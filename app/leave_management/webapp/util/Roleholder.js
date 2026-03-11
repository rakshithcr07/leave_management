sap.ui.define([], function() {
    "use strict";
    return {
        hasRole: function(sRole) {
            // In a real app, parse this from the XSUAA user info service
            // For now, it defaults to true to let you develop
            return true; 
        }
    };
});