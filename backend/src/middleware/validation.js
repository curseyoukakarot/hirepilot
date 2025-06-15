const { body, validationResult } = require('express-validator');

const validateLead = [
  // Name validation
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  // Email validation
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  // Phone validation
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Invalid phone number format'),

  // Title validation
  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title must be less than 100 characters'),

  // Location validation
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters'),

  // Status validation
  body('status')
    .optional()
    .isIn(['New', 'Contacted', 'Interested', 'Not Interested'])
    .withMessage('Invalid status value'),

  // Tags validation
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      if (!Array.isArray(tags)) return true;
      return tags.every(tag => 
        typeof tag === 'string' && 
        tag.length >= 2 && 
        tag.length <= 50
      );
    })
    .withMessage('Each tag must be between 2 and 50 characters'),

  // Validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = {
  validateLead
}; 