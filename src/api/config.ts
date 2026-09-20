// CrimeSphere AI — API configuration
//
// Set EXPO_PUBLIC_API_URL in .env to the ApiUrl output of the deployed SAM stack, e.g.
//   EXPO_PUBLIC_API_URL=https://abc123.execute-api.ap-south-1.amazonaws.com/api/v1
// With no URL configured (or EXPO_PUBLIC_USE_MOCK=true) the app runs exactly as before,
// on mock data, so the offline demo keeps working.
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? '';
export const USE_MOCK: boolean = process.env.EXPO_PUBLIC_USE_MOCK === 'true' || API_URL === '';
