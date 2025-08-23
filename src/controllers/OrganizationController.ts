import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/express';
import OrganisationApplication, {
  IOrganisationApplication,
} from '../models/OrganisationsApplications';
import User, { IUserDocument } from '../models/User';

interface CreateApplicationRequest extends AuthenticatedRequest {
  body: {
    type: 'institution' | 'company';
    description: string;
    document: string;
  };
}

interface UpdateApplicationRequest extends AuthenticatedRequest {
  body: {
    status?: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
  };
}

class OrganizationController {
  /**
   * Create a new organization application
   */
  public static async createApplication(
    req: CreateApplicationRequest,
    res: Response
  ): Promise<void> {
    try {
      const { description, document, type } = req.body;
      const userId = req.user._id;

      if (!type || !description || !document) {
        res.status(400).json({
          error: 'Type, description, and document are required',
        });
        return;
      }

      // Check if user already has a pending or approved application
      const existingApplication = await OrganisationApplication.findOne({
        user: userId,
        status: { $in: ['pending', 'approved'] },
      });

      if (existingApplication) {
        res.status(400).json({
          error: `You already have a ${existingApplication.status} organization application`,
        });
        return;
      }

      const application = new OrganisationApplication({
        user: userId,
        type,
        description,
        document,
      });

      await application.save();

      res.status(201).json({
        success: true,
        application: {
          id: application._id.toString(),
          type: application.type,
          description: application.description,
          document: application.document,
          status: application.status,
          createdAt: application.createdAt,
          updatedAt: application.updatedAt,
        },
        message: 'Organization application submitted successfully',
      });
    } catch (error) {
      console.error('Create application error:', error);
      res
        .status(500)
        .json({ error: 'Failed to create organization application' });
    }
  }

  /**
   * Get user's organization applications
   */
  public static async getUserApplications(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user._id;

      const applications = await OrganisationApplication.find({ user: userId })
        .sort({ createdAt: -1 })
        .select('-user');

      res.json({
        success: true,
        applications: applications.map((app) => ({
          id: app._id.toString(),
          type: app.type,
          description: app.description,
          document: app.document,
          status: app.status,
          rejectionReason: app.rejectionReason,
          createdAt: app.createdAt,
          updatedAt: app.updatedAt,
        })),
      });
    } catch (error) {
      console.error('Get user applications error:', error);
      res.status(500).json({ error: 'Failed to get applications' });
    }
  }

  /**
   * Get a specific application by ID
   */
  public static async getApplication(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { applicationId } = req.params;
      const userId = req.user._id;

      const application = await OrganisationApplication.findOne({
        _id: applicationId,
        user: userId,
      });

      if (!application) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }

      res.json({
        success: true,
        application: {
          id: application._id.toString(),
          description: application.description,
          document: application.document,
          status: application.status,
          rejectionReason: application.rejectionReason,
          createdAt: application.createdAt,
          updatedAt: application.updatedAt,
        },
      });
    } catch (error) {
      console.error('Get application error:', error);
      res.status(500).json({ error: 'Failed to get application' });
    }
  }

  /**
   * Update an application (only if pending)
   */
  public static async updateApplication(
    req: CreateApplicationRequest,
    res: Response
  ): Promise<void> {
    try {
      const { applicationId } = req.params;
      const { description, document } = req.body;
      const userId = req.user._id;

      const application = await OrganisationApplication.findOne({
        _id: applicationId,
        user: userId,
        status: 'pending',
      });

      if (!application) {
        res.status(404).json({
          error: 'Pending application not found or cannot be updated',
        });
        return;
      }

      if (description) {
        application.description = description;
      }

      if (document) {
        application.document = document;
      }

      await application.save();

      res.json({
        success: true,
        application: {
          id: application._id.toString(),
          description: application.description,
          document: application.document,
          status: application.status,
          createdAt: application.createdAt,
          updatedAt: application.updatedAt,
        },
        message: 'Application updated successfully',
      });
    } catch (error) {
      console.error('Update application error:', error);
      res.status(500).json({ error: 'Failed to update application' });
    }
  }

  /**
   * Delete an application (only if pending)
   */
  public static async deleteApplication(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { applicationId } = req.params;
      const userId = req.user._id;

      const application = await OrganisationApplication.findOne({
        _id: applicationId,
        user: userId,
        status: 'pending',
      });

      if (!application) {
        res.status(404).json({
          error: 'Pending application not found or cannot be deleted',
        });
        return;
      }

      await OrganisationApplication.findByIdAndDelete(applicationId);

      res.json({
        success: true,
        message: 'Application deleted successfully',
      });
    } catch (error) {
      console.error('Delete application error:', error);
      res.status(500).json({ error: 'Failed to delete application' });
    }
  }

  /**
   * Get all applications (Admin only)
   */
  public static async getAllApplications(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const user = req.user;

      // Check if user is admin
      if (!user.isAdmin) {
        res
          .status(403)
          .json({ error: 'Access denied. Admin privileges required.' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const skip = (page - 1) * limit;

      // Build filter
      const filter: any = {};
      if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        filter.status = status;
      }

      const applications = await OrganisationApplication.find(filter)
        .populate('user', 'name email walletAddress userType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await OrganisationApplication.countDocuments(filter);

      res.json({
        success: true,
        applications: applications.map((app) => {
          const user = app.user as any;
          return {
            id: app._id.toString(),
            user: {
              id: user._id.toString(),
              name: user.name,
              email: user.email,
              walletAddress: user.walletAddress,
              userType: user.userType,
            },
            description: app.description,
            document: app.document,
            status: app.status,
            rejectionReason: app.rejectionReason,
            createdAt: app.createdAt,
            updatedAt: app.updatedAt,
          };
        }),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Get all applications error:', error);
      res.status(500).json({ error: 'Failed to get applications' });
    }
  }

  /**
   * Review an application (Admin only)
   */
  public static async reviewApplication(
    req: UpdateApplicationRequest,
    res: Response
  ): Promise<void> {
    try {
      const user = req.user;
      const { applicationId } = req.params;
      const { status, rejectionReason } = req.body;

      // Check if user is admin
      if (!user.isAdmin) {
        res
          .status(403)
          .json({ error: 'Access denied. Admin privileges required.' });
        return;
      }

      if (!status || !['approved', 'rejected'].includes(status)) {
        res.status(400).json({
          error: 'Status must be either "approved" or "rejected"',
        });
        return;
      }

      if (status === 'rejected' && !rejectionReason) {
        res.status(400).json({
          error: 'Rejection reason is required when rejecting an application',
        });
        return;
      }

      const application = await OrganisationApplication.findOne({
        _id: applicationId,
        status: 'pending',
      }).populate('user');

      if (!application) {
        res.status(404).json({
          error: 'Pending application not found',
        });
        return;
      }

      application.status = status;
      if (status === 'rejected') {
        application.rejectionReason = rejectionReason;
      }

      await application.save();

      // If approved, update user type to institution
      if (status === 'approved') {
        const applicationUser = await User.findById(application.user._id);
        if (applicationUser) {
          applicationUser.userType = 'institution';
          applicationUser.isVerified = true;
          await applicationUser.save();
        }
      }

      res.json({
        success: true,
        application: {
          id: application._id.toString(),
          user: {
            id: (application.user as any)._id.toString(),
            name: (application.user as any).name,
            email: (application.user as any).email,
            walletAddress: (application.user as any).walletAddress,
          },
          description: application.description,
          document: application.document,
          status: application.status,
          rejectionReason: application.rejectionReason,
          createdAt: application.createdAt,
          updatedAt: application.updatedAt,
        },
        message: `Application ${status} successfully`,
      });
    } catch (error) {
      console.error('Review application error:', error);
      res.status(500).json({ error: 'Failed to review application' });
    }
  }

  /**
   * Get application statistics (Admin only)
   */
  public static async getApplicationStats(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const user = req.user;

      // Check if user is admin
      if (!user.isAdmin) {
        res
          .status(403)
          .json({ error: 'Access denied. Admin privileges required.' });
        return;
      }

      const stats = await OrganisationApplication.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      const totalApplications = await OrganisationApplication.countDocuments();
      const recentApplications = await OrganisationApplication.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      });

      const statsByStatus = stats.reduce(
        (acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        },
        {} as Record<string, number>
      );

      res.json({
        success: true,
        stats: {
          total: totalApplications,
          pending: statsByStatus.pending || 0,
          approved: statsByStatus.approved || 0,
          rejected: statsByStatus.rejected || 0,
          recentApplications,
        },
      });
    } catch (error) {
      console.error('Get application stats error:', error);
      res.status(500).json({ error: 'Failed to get application statistics' });
    }
  }

  /**
   * Get verified organizations
   */
  public static async getVerifiedOrganizations(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const organizations = await User.find({
        userType: 'institution',
        isVerified: true,
      })
        .select(
          'name email walletAddress profile.website profile.bio createdAt'
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await User.countDocuments({
        userType: 'institution',
        isVerified: true,
      });

      res.json({
        success: true,
        organizations: organizations.map((org) => ({
          id: org._id.toString(),
          name: org.name,
          email: org.email,
          walletAddress: org.walletAddress,
          website: org.profile?.website,
          bio: org.profile?.bio,
          createdAt: org.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Get verified organizations error:', error);
      res.status(500).json({ error: 'Failed to get verified organizations' });
    }
  }
}

export default OrganizationController;
