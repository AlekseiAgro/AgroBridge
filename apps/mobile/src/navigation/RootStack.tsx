import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CatalogScreen } from '../screens/CatalogScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { ConversationThreadScreen } from '../screens/ConversationThreadScreen';
import { CreateProductScreen } from '../screens/CreateProductScreen';
import { CreateRequestScreen } from '../screens/CreateRequestScreen';
import { DeleteAccountScreen } from '../screens/DeleteAccountScreen';
import { EditDisplayNameScreen } from '../screens/EditDisplayNameScreen';
import { EditProductScreen } from '../screens/EditProductScreen';
import { FarmDetailScreen } from '../screens/FarmDetailScreen';
import { FarmProfileScreen } from '../screens/FarmProfileScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MyProductsScreen } from '../screens/MyProductsScreen';
import { MyQuotesScreen, MyRequestsScreen } from '../screens/PersonalTradeScreen';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { RequestDetailScreen } from '../screens/RequestDetailScreen';
import { MyRfqsScreen } from '../screens/MyRfqsScreen';
import { RfqDetailScreen } from '../screens/RfqDetailScreen';
import { RfqInboxScreen } from '../screens/RfqInboxScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { RootTabs } from './RootTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={RootTabs} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
      <Stack.Screen name="Catalog" component={CatalogScreen} />
      <Stack.Screen name="CreateRequest" component={CreateRequestScreen} />
      <Stack.Screen name="FarmDetail" component={FarmDetailScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="ConversationThread" component={ConversationThreadScreen} />
      <Stack.Screen name="MyProducts" component={MyProductsScreen} />
      <Stack.Screen name="FarmProfile" component={FarmProfileScreen} />
      <Stack.Screen name="CreateProduct" component={CreateProductScreen} />
      <Stack.Screen name="EditProduct" component={EditProductScreen} />
      <Stack.Screen name="MyRequests" component={MyRequestsScreen} />
      <Stack.Screen name="MyQuotes" component={MyQuotesScreen} />
      <Stack.Screen name="EditDisplayName" component={EditDisplayNameScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="RfqDetail" component={RfqDetailScreen} />
      <Stack.Screen name="RfqInbox" component={RfqInboxScreen} />
      <Stack.Screen name="MyRfqs" component={MyRfqsScreen} />
    </Stack.Navigator>
  );
}
