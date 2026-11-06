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
  ProductDetail: { productId: string; ownerPreview?: boolean };
  RequestDetail: { requestId: string };
  Catalog: {
    query?: string;
    categoryId?: string;
    region?: string;
    regions?: string[];
    harvestStatus?: string;
    preorder?: boolean;
    inSeason?: boolean;
  } | undefined;
  CreateRequest: undefined;
  FarmDetail: { farmId: string };
  Login: undefined;
  Register: undefined;
  VerifyEmail: undefined;
  ConversationThread: { conversationId: string };
  MyProducts: undefined;
  FarmProfile: undefined;
  CreateProduct: undefined;
  EditProduct: { productId: string };
  MyRequests: undefined;
  MyQuotes: undefined;
  EditDisplayName: undefined;
  ChangePassword: undefined;
  DeleteAccount: undefined;
  RfqDetail: { rfqId: string };
  RfqInbox: undefined;
  MyRfqs: undefined;
};
