const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");
const definition = require("./swagger");

const openapiSpec = swaggerJsdoc({
  definition,
  apis: [path.join(__dirname, "../modules/**/*.routes.js").replace(/\\/g, "/")],
});

module.exports = openapiSpec;
