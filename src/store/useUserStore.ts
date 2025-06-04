import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { User } from '../api/types';
import { UserService } from '../api/services/userService';

interface UserState {
  // Data
  users: User[];
  selectedUser: User | null;
  currentUser: User | null; // For authentication context
  currentRegionalManager: User | null; // For default regional manager (user_id = 26)

  // Loading states
  isLoading: boolean;
  isLoadingUser: boolean;
  isLoadingRegionalManager: boolean; // Added loading state for regional manager

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
  initializeCurrentUser: () => Promise<void>;
  initializeCurrentRegionalManager: () => Promise<void>; // Added method for regional manager
  getCurrentRegionalManager: () => User | null; // Getter method
}

export const useUserStore = create<UserState>()(
  devtools(
    (set, get) => ({
      // Initial state
      users: [],
      selectedUser: null,
      currentUser: null,
      currentRegionalManager: null,
      isLoading: false,
      isLoadingUser: false,
      isLoadingRegionalManager: false,
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
          const userData = await UserService.getUserById(userId);

          if (userData) {
            set({
              selectedUser: userData,
              isLoadingUser: false
            });
          } else {
            set({
              error: 'User not found',
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
          const userData = await UserService.getUserByUsername(username);

          if (userData) {
            set({
              selectedUser: userData,
              isLoadingUser: false
            });
          } else {
            set({
              error: 'User not found',
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
      },

      initializeCurrentUser: async () => {
        try {
          console.log('Initializing current user...');
          set({ isLoadingUser: true, error: null });
          const userData = await UserService.getUserById(1);

          if (userData) {
            console.log('User fetched successfully:', userData);
            set({
              currentUser: userData,
              isLoadingUser: false
            });
          } else {
            console.log('No user found with ID 1, using fallback');
            // Fallback to demo user if user not found
            set({
              currentUser: {
                user_id: 1,
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@brickhousebrands.com',
                username: 'john.doe',
                role: 'store_manager',
                avatar_url: '',
                created_at: new Date(),
              },
              isLoadingUser: false
            });
          }
        } catch (error) {
          console.log('Error fetching user, using fallback:', error);
          // Fallback to demo user if API fails
          set({
            currentUser: {
              user_id: 1,
              first_name: 'John',
              last_name: 'Doe',
              email: 'john.doe@brickhousebrands.com',
              username: 'john.doe',
              role: 'store_manager',
              avatar_url: '',
              created_at: new Date(),
            },
            isLoadingUser: false,
            error: null // Clear error since we have fallback
          });
        }
      },

      initializeCurrentRegionalManager: async () => {
        try {
          console.log('Initializing current regional manager...');
          set({ isLoadingRegionalManager: true, error: null });
          const userData = await UserService.getUserById(26);

          if (userData) {
            console.log('Regional manager fetched successfully:', userData);
            set({
              currentRegionalManager: userData,
              isLoadingRegionalManager: false
            });
          } else {
            console.log('No regional manager found with ID 26, using fallback');
            // Fallback to demo user if user not found
            set({
              currentRegionalManager: {
                user_id: 26,
                first_name: 'Jane',
                last_name: 'Doe',
                email: 'jane.doe@brickhousebrands.com',
                username: 'jane.doe',
                role: 'regional_manager',
                avatar_url: '',
                created_at: new Date(),
              },
              isLoadingRegionalManager: false
            });
          }
        } catch (error) {
          console.log('Error fetching regional manager, using fallback:', error);
          // Fallback to demo user if API fails
          set({
            currentRegionalManager: {
              user_id: 26,
              first_name: 'Jane',
              last_name: 'Doe',
              email: 'jane.doe@brickhousebrands.com',
              username: 'jane.doe',
              role: 'regional_manager',
              avatar_url: '',
              created_at: new Date(),
            },
            isLoadingRegionalManager: false,
            error: null // Clear error since we have fallback
          });
        }
      },

      getCurrentRegionalManager: () => {
        return get().currentRegionalManager;
      }
    }),
    {
      name: 'user-store',
    }
  )
); 