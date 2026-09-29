import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text } from 'react-native';

import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import { AccountScreen } from '../screens/AccountScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { RequestsScreen } from '../screens/RequestsScreen';
import { useTheme } from '../theme/ThemeProvider';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const tabLabelKey: Record<keyof RootTabParamList, MessageKey> = {
  Home: 'tabs.home',
  Requests: 'tabs.requests',
  Messages: 'tabs.messages',
  Notifications: 'tabs.notifications',
  Account: 'tabs.account',
};

const tabIcon: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Requests: 'document-text-outline',
  Messages: 'chatbubble-outline',
  Notifications: 'notifications-outline',
  Account: 'person-outline',
};

export function RootTabs() {
  const { t } = useI18n();
  const { colors, iconSize } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.brandDeep,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarIcon: ({ color }) => (
          <Ionicons name={tabIcon[route.name]} size={iconSize.md} color={color} />
        ),
        tabBarLabel: ({ color }) => (
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.4}
            numberOfLines={2}
            style={[styles.label, { color }]}
          >
            {t(tabLabelKey[route.name])}
          </Text>
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarAccessibilityLabel: t('tabs.home') }}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={{ tabBarAccessibilityLabel: t('tabs.requests') }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarAccessibilityLabel: t('tabs.messages') }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarAccessibilityLabel: t('tabs.notifications') }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{ tabBarAccessibilityLabel: t('tabs.account') }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },
});
