const express = require("express");
const customerController = require("../controllers/customerController");
const customerPaymentController = require("../controllers/customerPaymentController");

const router = express.Router();

router.get("/", customerController.getCustomers);
router.get("/summary", customerController.getCustomersSummary);
router.post("/", customerController.createCustomer);

router.get("/:id", customerController.getCustomerById);
router.put("/:id", customerController.updateCustomer);
router.delete("/:id", customerController.deleteCustomer);

// Credit sales, installments and the combined statement of one customer
router.get("/:id/sales", customerController.getCustomerSales);
router.get("/:id/returns", customerController.getCustomerReturns);
router.get("/:id/statement", customerController.getCustomerStatement);

router.get("/:id/payments", customerPaymentController.getPayments);
router.post("/:id/payments", customerPaymentController.createPayment);
router.delete(
    "/:id/payments/:paymentId",
    customerPaymentController.deletePayment
);

module.exports = router;
