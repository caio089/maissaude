export type AsaasBillingType = "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED"

export type AsaasCycle = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY"

export type AsaasCustomer = {
  id: string
  name?: string
  email?: string
  cpfCnpj?: string
  mobilePhone?: string
  externalReference?: string
  deleted?: boolean
}

export type AsaasCustomerList = {
  data?: AsaasCustomer[]
}

export type AsaasPayment = {
  id: string
  customer?: string
  subscription?: string
  billingType?: AsaasBillingType | string
  status?: string
  value?: number
  dueDate?: string
  invoiceUrl?: string
  externalReference?: string
  description?: string
  paymentLink?: string
  deleted?: boolean
}

export type AsaasPaymentLink = {
  id?: string
  url?: string
  externalReference?: string
  deleted?: boolean
}

export type AsaasPaymentList = {
  data?: AsaasPayment[]
}

export type AsaasPixQrCode = {
  encodedImage?: string
  payload?: string
  expirationDate?: string
}

export type AsaasSubscription = {
  id: string
  customer?: string
  billingType?: AsaasBillingType | string
  cycle?: string
  value?: number
  status?: string
  nextDueDate?: string
  externalReference?: string
  deleted?: boolean
}

export type AsaasWebhookPayload = {
  id?: string
  event?: string
  payment?: AsaasPayment & { pixQrCodeId?: string }
  subscription?: AsaasSubscription
}
