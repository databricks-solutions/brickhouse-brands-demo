import { testConnection } from '../api/config/database';

export const runDatabaseTest = async (): Promise<{
  success: boolean;
  message: string;
  timestamp: Date;
}> => {
  const timestamp = new Date();

  try {
    const isConnected = await testConnection();

    if (isConnected) {
      return {
        success: true,
        message: 'Database connection successful! Ready to fetch data.',
        timestamp
      };
    } else {
      return {
        success: false,
        message: 'Database connection failed. Please check your configuration.',
        timestamp
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Database connection error: ${error}`,
      timestamp
    };
  }
};

// Auto-test connection when the module loads (in development)
if (import.meta.env.DEV) {
  runDatabaseTest().then(result => {
    if (result.success) {
      console.log('✅ Database connection test passed');
    } else {
      console.warn('❌ Database connection test failed:', result.message);
    }
  });
} 