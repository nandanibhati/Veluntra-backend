const ApiError = require("../utils/ApiError");

/**
 * Validates req.body / req.query / req.params against a zod schema object
 * shaped like { body, query, params } (any subset). On success, replaces
 * each with the parsed (and type-coerced) value.
 *
 * Usage: router.post("/", validate({ body: createProductSchema }), handler)
 */
function validate(schemas) {
  return (req, res, next) => {
    for (const key of ["body", "query", "params"]) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));
        throw ApiError.badRequest("Validation failed", details);
      }
      req[key] = result.data;
    }
    next();
  };
}

module.exports = validate;
