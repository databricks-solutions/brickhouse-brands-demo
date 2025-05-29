import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { User } from '../api/types';
import { UserService } from '../api/services/userService';

interface UserState {
  // Data
  users: User[];
  selectedUser: User | null;
  currentUser: User | null; // For authentication context

  // Loading states
  isLoading: boolean;
  isLoadingUser: boolean;

  // Error states
  error: string | null;

  // Actions
  fetchUsers: () => Promise<void>;
  fetchUserById: (userId: number) => Promise<void>;
  fetchUserByUsername: (username: string) => Promise<void>;
  createUser: (userData: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'store_manager' | 'regional_manager';
    storeId?: number;
    region?: string;
  }) => Promise<boolean>;
  updateUser: (
    userId: number,
    updateData: Partial<{
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      role: 'store_manager' | 'regional_manager';
      storeId: number;
      region: string;
    }>
  ) => Promise<boolean>;
  getUsersByRole: (role: 'store_manager' | 'regional_manager') => Promise<void>;
  getUsersByRegion: (region: string) => Promise<void>;
  getStoreManagers: (storeId: number) => Promise<void>;
  getRegionalManagers: (region: string) => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  clearSelectedUser: () => void;
  refreshUsers: () => Promise<void>;
}

export const useUserStore = create<UserState>()(
  devtools(
    (set, get) => ({
      // Initial state
      users: [],
      selectedUser: null,
      currentUser: null,
      isLoading: false,
      isLoadingUser: false,
      error: null,

      // Actions
      fetchUsers: async () => {
        set({ isLoading: true, error: null });

        try {
          const users = await UserService.getUsers();

          set({
            users,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch users: ${error}`,
            isLoading: false
          });
        }
      },

      fetchUserById: async (userId: number) => {
        set({ isLoadingUser: true, error: null });

        try {
          const result = await UserService.getUserById(userId);

          if (result.success) {
            set({
              selectedUser: result.data,
              isLoadingUser: false
            });
          } else {
            set({
              error: result.error || 'Failed to fetch user',
              isLoadingUser: false
            });
          }
        } catch (error) {
          set({
            error: `Failed to fetch user: ${error}`,
            isLoadingUser: false
          });
        }
      },

      fetchUserByUsername: async (username: string) => {
        set({ isLoadingUser: true, error: null });

        try {
          const result = await UserService.getUserByUsername(username);

          if (result.success) {
            set({
              selectedUser: result.data,
              isLoadingUser: false
            });
          } else {
            set({
              error: result.error || 'Failed to fetch user',
              isLoadingUser: false
            });
          }
        } catch (error) {
          set({
            error: `Failed to fetch user: ${error}`,
            isLoadingUser: false
          });
        }
      },

      createUser: async (userData) => {
        set({ error: null });

        try {
          const result = await UserService.createUser(userData);

          if (result.success) {
            // Refresh users list
            await get().fetchUsers();

            return true;
          } else {
            set({
              error: result.error || 'Failed to create user'
            });
            return false;
          }
        } catch (error) {
          set({
            error: `Failed to create user: ${error}`
          });
          return false;
        }
      },

      updateUser: async (userId: number, updateData) => {
        set({ error: null });

        try {
          const result = await UserService.updateUser(userId, updateData);

          if (result.success) {
            // Update the user in the users list
            const { users } = get();
            const updatedUsers = users.map(user =>
              user.userId === userId
                ? { ...user, ...updateData }
                : user
            );

            set({ users: updatedUsers });

            // Update selected user if it's the same one
            const { selectedUser } = get();
            if (selectedUser && selectedUser.userId === userId) {
              set({
                selectedUser: { ...selectedUser, ...updateData }
              });
            }

            // Update current user if it's the same one
            const { currentUser } = get();
            if (currentUser && currentUser.userId === userId) {
              set({
                currentUser: { ...currentUser, ...updateData }
              });
            }

            return true;
          } else {
            set({
              error: result.error || 'Failed to update user'
            });
            return false;
          }
        } catch (error) {
          set({
            error: `Failed to update user: ${error}`
          });
          return false;
        }
      },

      getUsersByRole: async (role: 'store_manager' | 'regional_manager') => {
        set({ isLoading: true, error: null });

        try {
          const users = await UserService.getUsersByRole(role);
          set({
            users,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch users by role: ${error}`,
            isLoading: false
          });
        }
      },

      getUsersByRegion: async (region: string) => {
        set({ isLoading: true, error: null });

        try {
          const users = await UserService.getUsersByRegion(region);
          set({
            users,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch users by region: ${error}`,
            isLoading: false
          });
        }
      },

      getStoreManagers: async (storeId: number) => {
        set({ isLoading: true, error: null });

        try {
          const users = await UserService.getStoreManagers(storeId);
          set({
            users,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch store managers: ${error}`,
            isLoading: false
          });
        }
      },

      getRegionalManagers: async (region: string) => {
        set({ isLoading: true, error: null });

        try {
          const users = await UserService.getRegionalManagers(region);
          set({
            users,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch regional managers: ${error}`,
            isLoading: false
          });
        }
      },

      setCurrentUser: (user: User | null) => {
        set({ currentUser: user });
      },

      clearSelectedUser: () => {
        set({ selectedUser: null });
      },

      refreshUsers: async () => {
        await get().fetchUsers();
      }
    }),
    {
      name: 'user-store',
    }
  )
); 