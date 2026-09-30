import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { FarmDetailScreen } from '../screens/FarmDetailScreen';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { RequestDetailScreen } from '../screens/RequestDetailScreen';
import { RootTabs } from './RootTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={RootTabs} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
      <Stack.Screen name="FarmDetail" component={FarmDetailScreen} />
    </Stack.Navigator>
  );
}
