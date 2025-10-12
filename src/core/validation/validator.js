import { ValidationError } from "../errors/AppError.js";

/**
 * Validates data against a Joi schema
 * @param {Object} schema - Joi schema
 * @param {Object} data - Data to validate
 * @param {Object} options - Joi validation options
 * @returns {Object} Validated data
 * @throws {ValidationError} If validation fails
 */
export const validate = (schema, data, options = {}) => {
  const defaultOptions = {
    abortEarly: false,
    stripUnknown: true,
    ...options,
  };

  const { error, value } = schema.validate(data, defaultOptions);

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    throw new ValidationError("Validation failed", details);
  }

  return value;
};

/**
 * Middleware factory for request validation
 * @param {Object} schema - Joi schema
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 */
export const validateRequest = (schema, property = "body") => {
  return (req, res, next) => {
    try {
      req[property] = validate(schema, req[property]);
      next();
    } catch (error) {
      next(error);
    }
  };
};
