const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { addressSchema, updateAddressSchema } = require("./addresses.validation");
const { idParamSchema } = require("../../utils/commonSchemas");
const controller = require("./addresses.controller");

const router = Router();
router.use(requireAuth);

/**
 * @openapi
 * /addresses:
 *   get:
 *     tags: [Addresses]
 *     summary: List the current user's saved addresses
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Addresses]
 *     summary: Add a new address
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.list);
router.post("/", validate({ body: addressSchema }), controller.create);

/**
 * @openapi
 * /addresses/{id}:
 *   patch:
 *     tags: [Addresses]
 *     summary: Update an address
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Addresses]
 *     summary: Delete an address
 *     security: [{ bearerAuth: [] }]
 */
router.patch("/:id", validate({ params: idParamSchema(), body: updateAddressSchema }), controller.update);
router.delete("/:id", validate({ params: idParamSchema() }), controller.remove);

module.exports = router;
