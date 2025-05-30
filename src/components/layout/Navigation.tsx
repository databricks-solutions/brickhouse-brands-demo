import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, User } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";

interface NavigationProps {
  activeTab: 'order-management' | 'insights';
  onTabChange: (tab: 'order-management' | 'insights') => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { currentUser } = useUserStore();

  // Handle both snake_case (API) and camelCase field names
  const user = currentUser ? {
    userId: (currentUser as any).user_id || currentUser.userId || 1,
    firstName: (currentUser as any).first_name || currentUser.firstName || 'John',
    lastName: (currentUser as any).last_name || currentUser.lastName || 'Doe',
    email: currentUser.email || 'john.doe@brickstorebrands.com',
    username: currentUser.username || 'john.doe',
    role: currentUser.role || 'store_manager' as const,
    avatarUrl: (currentUser as any).avatar_url || currentUser.avatarUrl || '', // Handle both naming conventions
    createdAt: (currentUser as any).created_at || currentUser.createdAt || new Date(),
  } : {
    userId: 1,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@brickstorebrands.com',
    username: 'john.doe',
    role: 'store_manager' as const,
    avatarUrl: '',
    createdAt: new Date(),
  };

  const handleSettings = () => {
    console.log('Settings clicked');
    // TODO: Implement settings functionality
  };

  const handleLogout = () => {
    console.log('Logout clicked');
    // TODO: Implement logout functionality
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Left section: Logo and Company Name */}
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-3">
              {/* Databricks Logo */}
              <div className="w-8 h-8 flex items-center justify-center">
                <img
                  src="https://cdn.brandfetch.io/idSUrLOWbH/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B"
                  alt="Databricks Logo"
                  className="w-8 h-8"
                />
              </div>
              <span className="text-xl font-semibold text-gray-900">
                Brickstore Brands
              </span>
            </div>

            {/* Vertical separator */}
            <div className="h-6 w-px bg-gray-300"></div>

            {/* Navigation buttons */}
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                className={`px-4 py-2 font-medium transition-colors relative ${activeTab === 'order-management'
                  ? 'text-blue-600 hover:text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
                onClick={() => onTabChange('order-management')}
              >
                Order Management
                {activeTab === 'order-management' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </Button>
              <Button
                variant="ghost"
                className={`px-4 py-2 font-medium transition-colors relative ${activeTab === 'insights'
                  ? 'text-blue-600 hover:text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
                onClick={() => onTabChange('insights')}
              >
                Insights
                {activeTab === 'insights' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </Button>
            </div>
          </div>

          {/* Right section: User Avatar */}
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={user.avatarUrl}
                      alt={`${user.firstName} ${user.lastName}`}
                    />
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium leading-none">{user.firstName} {user.lastName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSettings} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}; 