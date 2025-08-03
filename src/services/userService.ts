import { db } from '../firebase/config';
import { User, UserStatus, AuthProvider } from '../types';
import { Timestamp } from 'firebase/firestore';

export class UserService {
  private readonly COLLECTION = 'users';

  /**
   * Create new user from Google OAuth data
   */
  async createGoogleUser(firebaseUser: any): Promise<User> {
    const userData: Omit<User, 'id'> = {
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Unnamed User',
      photoURL: firebaseUser.photoURL || undefined,
      role: 'user', // Default role
      status: 'pending', // Requires admin approval
      authProvider: 'google',
      
      // Default permissions (none until approved)
      permissions: {
        gate: false,
        garage: false,
        camera: false,
        stopMode: false,
        viewLogs: false,
        manageUsers: false,
        requireLocation: false,
        allowGPS: false,
        requireLocationProximity: false,
      },
      
      gpsEnabled: false,
      createdAt: new Date(),
      lastLogin: new Date(),
      requestedAt: new Date(), // When user requested access
    };

    try {
      // Check if user already exists
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        // Update last login
        await this.updateLastLogin(existingUser.id);
        return existingUser;
      }

      // Create new user
      const docRef = await db.collection(this.COLLECTION).add({
        ...userData,
        createdAt: Timestamp.fromDate(userData.createdAt),
        lastLogin: Timestamp.fromDate(userData.lastLogin),
        requestedAt: Timestamp.fromDate(userData.requestedAt!),
      });

      console.log('🆕 New Google user created:', userData.email, 'ID:', docRef.id);
      
      // Send notification to admins about new user
      await this.notifyAdminsNewUser(userData.email, userData.displayName);

      return {
        id: docRef.id,
        ...userData,
      };
    } catch (error) {
      console.error('❌ Error creating Google user:', error);
      throw new Error('Failed to create user');
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const querySnapshot = await db.collection(this.COLLECTION)
        .where('email', '==', email)
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      return {
        id: doc.id,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        nick: data.nick,
        role: data.role,
        status: data.status,
        authProvider: data.authProvider || 'email', // Backward compatibility
        permissions: data.permissions,
        gpsEnabled: data.gpsEnabled || false,
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLogin: data.lastLogin?.toDate() || new Date(),
        requestedAt: data.requestedAt?.toDate(),
        approvedAt: data.approvedAt?.toDate(),
        approvedBy: data.approvedBy,
        rejectedAt: data.rejectedAt?.toDate(),
        rejectedBy: data.rejectedBy,
        rejectedReason: data.rejectedReason,
      };
    } catch (error) {
      console.error('❌ Error getting user by email:', error);
      return null;
    }
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      await db.collection(this.COLLECTION).doc(userId).update({
        lastLogin: Timestamp.now(),
      });
    } catch (error) {
      console.error('❌ Error updating last login:', error);
    }
  }

  /**
   * Get all pending users (admin function)
   */
  async getPendingUsers(): Promise<User[]> {
    try {
      const querySnapshot = await db.collection(this.COLLECTION)
        .where('status', '==', 'pending')
        .orderBy('requestedAt', 'desc')
        .get();

      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email,
          displayName: data.displayName,
          photoURL: data.photoURL,
          nick: data.nick,
          role: data.role,
          status: data.status,
          authProvider: data.authProvider || 'email',
          permissions: data.permissions,
          gpsEnabled: data.gpsEnabled || false,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate() || new Date(),
          requestedAt: data.requestedAt?.toDate(),
          approvedAt: data.approvedAt?.toDate(),
          approvedBy: data.approvedBy,
          rejectedAt: data.rejectedAt?.toDate(),
          rejectedBy: data.rejectedBy,
          rejectedReason: data.rejectedReason,
        };
      });
    } catch (error) {
      console.error('❌ Error getting pending users:', error);
      return [];
    }
  }

  /**
   * Approve user (admin function)
   */
  async approveUser(userId: string, adminId: string): Promise<void> {
    try {
      await db.collection(this.COLLECTION).doc(userId).update({
        status: 'approved',
        approvedAt: Timestamp.now(),
        approvedBy: adminId,
        // Grant basic permissions
        'permissions.gate': true,
        'permissions.garage': true,
        'permissions.camera': true,
      });

      console.log('✅ User approved:', userId, 'by admin:', adminId);
      
      // TODO: Send email notification to user about approval
    } catch (error) {
      console.error('❌ Error approving user:', error);
      throw new Error('Failed to approve user');
    }
  }

  /**
   * Reject user (admin function)
   */
  async rejectUser(userId: string, adminId: string, reason?: string): Promise<void> {
    try {
      await db.collection(this.COLLECTION).doc(userId).update({
        status: 'rejected',
        rejectedAt: Timestamp.now(),
        rejectedBy: adminId,
        rejectedReason: reason || 'No reason provided',
      });

      console.log('❌ User rejected:', userId, 'by admin:', adminId, 'reason:', reason);
      
      // TODO: Send email notification to user about rejection
    } catch (error) {
      console.error('❌ Error rejecting user:', error);
      throw new Error('Failed to reject user');
    }
  }

  /**
   * Notify admins about new user registration
   */
  private async notifyAdminsNewUser(userEmail: string, displayName: string): Promise<void> {
    try {
      // Get all admin users
      const adminQuery = await db.collection(this.COLLECTION)
        .where('role', '==', 'admin')
        .where('status', '==', 'approved')
        .get();

      const adminEmails = adminQuery.docs
        .map(doc => doc.data().email)
        .filter(email => email);

      console.log('📧 New user notification should be sent to admins:', adminEmails);
      console.log(`📝 New user: ${displayName} (${userEmail}) is waiting for approval`);
      
      // TODO: Implement actual email notification
      // For now, just log to console
      
    } catch (error) {
      console.error('❌ Error notifying admins:', error);
    }
  }

  /**
   * Check if user has admin privileges
   */
  isAdmin(user: User | null): boolean {
    return user?.role === 'admin' && user?.status === 'approved';
  }

  /**
   * Check if user can access the application
   */
  canAccess(user: User | null): boolean {
    return user?.status === 'approved';
  }
}

// Export singleton instance
export const userService = new UserService();