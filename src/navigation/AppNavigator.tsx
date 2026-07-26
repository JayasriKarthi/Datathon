// CrimeSphere AI — AppNavigator

import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';

import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/colors';

// Screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ControlRoomScreen } from '../screens/dashboard/ControlRoomScreen';
import { CaseFilesScreen } from '../screens/cases/CaseFilesScreen';
import { CaseDetailScreen } from '../screens/cases/CaseDetailScreen';
import { EvidenceViewerScreen } from '../screens/cases/EvidenceViewerScreen';
import { PersonCrimeTrackerScreen } from '../screens/tracker/PersonCrimeTrackerScreen';
import { DigitalNotebookScreen } from '../screens/notebook/DigitalNotebookScreen';
import { CrimeMapScreen } from '../screens/dashboard/CrimeMapScreen';
import { AlertsScreen } from '../screens/dashboard/AlertsScreen';
import { ProfileScreen } from '../screens/dashboard/ProfileScreen';
import { SettingsScreen } from '../screens/dashboard/SettingsScreen';

// Commissioner Screens
import { PoliceStationsScreen } from '../screens/commissioner/PoliceStationsScreen';
import { OfficerManagementScreen } from '../screens/commissioner/OfficerManagementScreen';
import { DistrictAnalyticsScreen } from '../screens/commissioner/DistrictAnalyticsScreen';
import { CrimeAnalyticsScreen } from '../screens/commissioner/CrimeAnalyticsScreen';
import { ReportsScreen } from '../screens/commissioner/ReportsScreen';
import { CaseAssignmentScreen } from '../screens/commissioner/CaseAssignmentScreen';
import { PerformanceDashboardScreen } from '../screens/commissioner/PerformanceDashboardScreen';
import { FIRManagementScreen } from '../screens/commissioner/FIRManagementScreen';

// Shared Module Screens
import { DocumentsScreen } from '../screens/cases/DocumentsScreen';
import { ComplaintLettersScreen } from '../screens/cases/ComplaintLettersScreen';

// FIR Filing
import { FileFIRScreen } from '../screens/fir/FileFIRScreen';

// Drawer
import { SideDrawer } from '../components/layout/SideDrawer';

// Types
import type {
  DrawerParamList,
  CaseStackParamList,
} from '../types/navigation';

const RootStack = createStackNavigator();
const Drawer = createDrawerNavigator<DrawerParamList>();
const CaseStack = createStackNavigator<CaseStackParamList>();

function CaseStackNavigator() {
  return (
    <CaseStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <CaseStack.Screen
        name="CaseFiles"
        component={CaseFilesScreen}
      />

      <CaseStack.Screen
        name="CaseDetail"
        component={CaseDetailScreen}
      />

      <CaseStack.Screen
        name="EvidenceViewer"
        component={EvidenceViewerScreen}
      />
    </CaseStack.Navigator>
  );
}

function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <SideDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: Platform.OS === 'web' ? 'permanent' : 'front',
        swipeEnabled: Platform.OS !== 'web',
        overlayColor: 'transparent',
        drawerStyle: {
          width: 230,
        },
      }}
    >
      <Drawer.Screen
        name="ControlRoom"
        component={ControlRoomScreen}
      />

      <Drawer.Screen
        name="PoliceStations"
        component={PoliceStationsScreen}
      />

      <Drawer.Screen
        name="OfficerManagement"
        component={OfficerManagementScreen}
      />

      <Drawer.Screen
        name="DistrictAnalytics"
        component={DistrictAnalyticsScreen}
      />

      <Drawer.Screen
        name="CrimeAnalytics"
        component={CrimeAnalyticsScreen}
      />

      <Drawer.Screen
        name="Reports"
        component={ReportsScreen}
      />

      <Drawer.Screen
        name="CaseAssignment"
        component={CaseAssignmentScreen}
      />

      <Drawer.Screen
        name="PerformanceDashboard"
        component={PerformanceDashboardScreen}
      />

      <Drawer.Screen
        name="FIRManagement"
        component={FIRManagementScreen}
      />

      <Drawer.Screen
        name="Documents"
        component={DocumentsScreen}
      />

      <Drawer.Screen
        name="ComplaintLetters"
        component={ComplaintLettersScreen}
      />

      <Drawer.Screen
        name="CaseFiles"
        component={CaseStackNavigator}
      />

      <Drawer.Screen
        name="CaseDetail"
        component={CaseDetailScreen}
      />

      <Drawer.Screen
        name="EvidenceViewer"
        component={EvidenceViewerScreen}
      />

      <Drawer.Screen
        name="PersonCrimeTracker"
        component={PersonCrimeTrackerScreen}
      />

      <Drawer.Screen
        name="DutyNotebook"
        component={DigitalNotebookScreen}
      />

      <Drawer.Screen
        name="CrimeMap"
        component={CrimeMapScreen}
      />

      <Drawer.Screen
        name="Alerts"
        component={AlertsScreen}
      />

      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
      />

      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
      />

      <Drawer.Screen
        name="FileFIR"
        component={FileFIRScreen}
      />
    </Drawer.Navigator>
  );
}

function AuthNavigator() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <RootStack.Screen
        name="Login"
        component={LoginScreen}
      />

      <RootStack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
      />
    </RootStack.Navigator>
  );
}

export const AppNavigator = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <NavigationContainer>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {isAuthenticated ? (
          <RootStack.Screen
            name="App"
            component={DrawerNavigator}
          />
        ) : (
          <RootStack.Screen
            name="Auth"
            component={AuthNavigator}
          />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};