import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthProvider';
import { I18nProvider } from './src/i18n/I18nProvider';
import { RootTabs } from './src/navigation/RootTabs';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

function RootNavigation() {
  const { colors } = useTheme();
  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.ink,
      border: colors.line,
      primary: colors.brandDeep,
      notification: colors.brand,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style="dark" />
      <RootTabs />
    </NavigationContainer>
  );
}

export function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <RootNavigation />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
