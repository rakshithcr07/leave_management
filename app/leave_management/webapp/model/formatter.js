sap.ui.define([], function () {
    "use strict";
    return {
        statusState: function (sStatus) {
            switch (sStatus) {
                case "Approved": return "Success";
                case "Pending": return "Warning";
                case "Rejected": return "Error";
                default: return "None";
            }
        }
    };
});