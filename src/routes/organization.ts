import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import OrganizationController from '../controllers/OrganizationController';
import { auth } from '../middleware/auth';

const router = Router();

const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

/**
 * @route POST /api/organization/applications
 * @desc Create a new organization application
 * @access Private (authenticated users)
 */
router.post(
  '/applications',
  auth,
  [
    body('description')
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    body('document')
      .notEmpty()
      .withMessage('Document is required'),
  ],
  handleValidationErrors,
  OrganizationController.createApplication as any
);

/**
 * @route GET /api/organization/applications
 * @desc Get user's organization applications
 * @access Private (authenticated users)
 */
router.get(
  '/applications',
  auth,
  OrganizationController.getUserApplications as any
);

/**
 * @route GET /api/organization/applications/:applicationId
 * @desc Get a specific application by ID
 * @access Private (authenticated users - own applications only)
 */
router.get(
  '/applications/:applicationId',
  auth,
  [
    param('applicationId')
      .isMongoId()
      .withMessage('Invalid application ID format'),
  ],
  handleValidationErrors,
  OrganizationController.getApplication as any
);

/**
 * @route PUT /api/organization/applications/:applicationId
 * @desc Update an application (only if pending)
 * @access Private (authenticated users - own applications only)
 */
router.put(
  '/applications/:applicationId',
  auth,
  [
    param('applicationId')
      .isMongoId()
      .withMessage('Invalid application ID format'),
    body('description')
      .optional()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    body('document')
      .optional()
      .notEmpty()
      .withMessage('Document cannot be empty if provided'),
  ],
  handleValidationErrors,
  OrganizationController.updateApplication as any
);

/**
 * @route DELETE /api/organization/applications/:applicationId
 * @desc Delete an application (only if pending)
 * @access Private (authenticated users - own applications only)
 */
router.delete(
  '/applications/:applicationId',
  auth,
  [
    param('applicationId')
      .isMongoId()
      .withMessage('Invalid application ID format'),
  ],
  handleValidationErrors,
  OrganizationController.deleteApplication as any
);

/**
 * @route GET /api/organization/admin/applications
 * @desc Get all applications (Admin only)
 * @access Private (admin only)
 */
router.get(
  '/admin/applications',
  auth,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected'])
      .withMessage('Status must be pending, approved, or rejected'),
  ],
  handleValidationErrors,
  OrganizationController.getAllApplications as any
);

/**
 * @route PUT /api/organization/admin/applications/:applicationId/review
 * @desc Review an application (Admin only)
 * @access Private (admin only)
 */
router.put(
  '/admin/applications/:applicationId/review',
  auth,
  [
    param('applicationId')
      .isMongoId()
      .withMessage('Invalid application ID format'),
    body('status')
      .isIn(['approved', 'rejected'])
      .withMessage('Status must be either approved or rejected'),
    body('rejectionReason')
      .if(body('status').equals('rejected'))
      .notEmpty()
      .withMessage('Rejection reason is required when rejecting an application')
      .isLength({ min: 10, max: 500 })
      .withMessage('Rejection reason must be between 10 and 500 characters'),
  ],
  handleValidationErrors,
  OrganizationController.reviewApplication as any
);

/**
 * @route GET /api/organization/admin/stats
 * @desc Get application statistics (Admin only)
 * @access Private (admin only)
 */
router.get(
  '/admin/stats',
  auth,
  OrganizationController.getApplicationStats as any
);

/**
 * @route GET /api/organization/verified
 * @desc Get verified organizations
 * @access Public
 */
router.get(
  '/verified',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],
  handleValidationErrors,
  OrganizationController.getVerifiedOrganizations
);

/**
 * @route POST /api/organization/register-blockchain
 * @desc Register approved organization on blockchain
 * @access Private (verified institutions only)
 */
router.post(
  '/register-blockchain',
  auth,
  OrganizationController.registerOnBlockchain as any
);

export default router;
