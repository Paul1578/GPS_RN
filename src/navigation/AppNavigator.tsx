import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, View } from "react-native";
import { Home, Map, Route, Truck, User } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { WelcomeScreen } from "@/screens/auth/WelcomeScreen";
import { LoginScreen } from "@/screens/auth/LoginScreen";
import { RegisterScreen } from "@/screens/auth/RegisterScreen";
import { RecoveryScreen } from "@/screens/auth/RecoveryScreen";
import { DashboardScreen } from "@/screens/dashboard/DashboardScreen";
import { MapScreen } from "@/screens/dashboard/MapScreen";
import { RoutesScreen } from "@/screens/dashboard/RoutesScreen";
import { VehiclesScreen } from "@/screens/dashboard/VehiclesScreen";
import { ProfileScreen } from "@/screens/dashboard/ProfileScreen";
import { HistoryScreen } from "@/screens/dashboard/HistoryScreen";
import { TeamScreen } from "@/screens/dashboard/TeamScreen";
import { DriverRouteScreen } from "@/screens/dashboard/DriverRouteScreen";
import { useThemeColors } from "@/theme/colors";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { user } = useAuth();
  const colors = useThemeColors();
  const permissions = user?.permissions;
  const canViewMap = !!permissions?.canViewMap;
  const canCreateRoutes = !!permissions?.canCreateRoutes;
  const canManageVehicles = !!permissions?.canManageVehicles;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          paddingVertical: 6,
          height: 62,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, React.ComponentType<any>> = {
            Dashboard: Home,
            Mapa: Map,
            Rutas: Route,
            Vehiculos: Truck,
            Perfil: User,
          };
          const Icon = icons[route.name] ?? Home;
          return <Icon color={color} size={size} strokeWidth={1.75} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      {canViewMap && <Tab.Screen name="Mapa" component={MapScreen} />}
      {canCreateRoutes && <Tab.Screen name="Rutas" component={RoutesScreen} />}
      {canManageVehicles && <Tab.Screen name="Vehiculos" component={VehiclesScreen} />}
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoadingUser, user } = useAuth();
  const colors = useThemeColors();
  const permissions = user?.permissions;
  const canViewHistory = !!permissions?.canViewMap || !!permissions?.canCreateRoutes;
  const canManageTeam = !!permissions?.canManageTeam;
  const canViewOwnRoute = !!permissions?.canViewOwnRoute;

  const headerStyle = {
    backgroundColor: colors.background,
  };

  const headerTitleStyle = {
    color: colors.text,
  };

  return (
    <NavigationContainer>
      {isLoadingUser ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          {isAuthenticated ? (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              {canViewHistory && (
                <Stack.Screen
                  name="Historial"
                  component={HistoryScreen}
                  options={{
                    headerShown: true,
                    title: "Historial de rutas",
                    headerStyle,
                    headerTitleStyle,
                    headerTintColor: colors.text,
                  }}
                />
              )}
              {canManageTeam && (
                <Stack.Screen
                  name="Equipo"
                  component={TeamScreen}
                  options={{
                    headerShown: true,
                    title: "Equipo",
                    headerStyle,
                    headerTitleStyle,
                    headerTintColor: colors.text,
                  }}
                />
              )}
              {canViewOwnRoute && (
                <Stack.Screen
                  name="MiRuta"
                  component={DriverRouteScreen}
                  options={{
                    headerShown: true,
                    title: "Mi ruta",
                    headerStyle,
                    headerTitleStyle,
                    headerTintColor: colors.text,
                  }}
                />
              )}
            </>
          ) : (
            <>
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="Recovery" component={RecoveryScreen} />
            </>
          )}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
