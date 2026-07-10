const { z } = require("zod");

/** Validates a single :paramName route param as a UUID (every id in this schema is a
 * `String @id @default(uuid())`) — without this, a malformed id falls through to Prisma and
 * surfaces as a raw 500 instead of a clean 400. Usage:
 *   validate({ params: idParamSchema() })            // -> { id: <uuid> }
 *   validate({ params: idParamSchema("productId") })  // -> { productId: <uuid> }
 */
function idParamSchema(paramName = "id") {
  return z.object({ [paramName]: z.string().uuid("Invalid id") });
}

module.exports = { idParamSchema };
