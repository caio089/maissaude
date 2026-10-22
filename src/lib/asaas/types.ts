export type AsaasBillingType = "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED"

export type AsaasCustomer = {
  id: string
  name?: string
  email?: string
  cpfCnpj?: string
  mobilePhone?: string
  externalReference?: string
}

export type AsaasCustomerList = {
  data?: AsaasCustomer[]
}

export type AsaasPayment = {
  id: string
  customer?: string
  billingType?: AsaasBillingType
  status?: string
  value?: number
  dueDate?: string
  invoiceUrl?: string
  externalReference?: string
  description?: string
}

export type AsaasPixQrCode = {
  encodedImage?: string
  payload?: string
  expirationDate?: string
}

export type AsaasSubscription = {
  id: string
  customer?: string
  billingType?: AsaasBillingType
  cycle?: string
  value?: number
  status?: string
  nextDueDate?: string
  externalReference?: string
}

export type AsaasWebhookPayload = {
  id?: string
  event?: string
  payment?: AsaasPayment & { pixQrCodeId?: string }
  subscription?: AsaasSubscription
}
