export const orderStatuses = { pending: 'Aguardando confirmação', confirmed: 'Confirmado', preparing: 'Em separação', completed: 'Concluído', cancelled: 'Cancelado' } as const;
export type OrderStatus = keyof typeof orderStatuses;
export const nextOrderStatuses: Record<OrderStatus, OrderStatus[]> = { pending: ['confirmed','cancelled'], confirmed: ['preparing','completed','cancelled'], preparing: ['completed','cancelled'], completed: [], cancelled: [] };
export type OrderItem = { id: string; product_name: string; sku: string; size_name: string; color_name: string; quantity: number; unit_price_cents: number };
export type Order = { id: string; number: number; customer_name: string; customer_email: string; customer_phone: string; delivery_method: 'pickup'|'delivery'; address: Record<string,string>|null; notes: string; subtotal_cents: number; status: OrderStatus; revision: string; created_at: string; order_items: OrderItem[] };
export function orderError(error: unknown): string {
  const message = (error as {message?:string})?.message ?? '';
  const code = (error as {code?:string})?.code;
  if (message.includes('STOCK_UNAVAILABLE')) return 'Um item ficou indisponível ou está sem estoque suficiente. Revise o carrinho.';
  if (message.includes('PRICE_CHANGED')) return 'O preço mudou. Atualize o carrinho e confira os novos valores antes de enviar.';
  if (message.includes('RATE_LIMIT')) return 'Você enviou vários pedidos recentemente. Aguarde 10 minutos antes de enviar outro.';
  if (message.includes('REQUEST_CONFLICT')) return 'Esta tentativa já foi usada com outros dados. Confira o pedido antes de iniciar outro.';
  if (message.includes('INVALID_')) return 'Confira os dados, o endereço e os itens do pedido.';
  if (code === '40001') return 'O pedido foi alterado em outra sessão. Atualize a lista antes de continuar.';
  if (code === '42501') return 'Sua sessão não tem permissão para esta operação.';
  return 'Não foi possível confirmar o resultado do envio. Tente novamente com os mesmos dados; a tentativa não gera pedido duplicado.';
}
