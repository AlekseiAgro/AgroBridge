import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootTabParamList = {
  Home: undefined;
  Requests: undefined;
  Messages: undefined;
  Notifications: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<RootTabParamList>;
  ProductDetail: { productId: string };
  RequestDetail: { requestId: string };
  FarmDetail: { farmId: string };
};
