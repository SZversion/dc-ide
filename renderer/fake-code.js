// Code shown in "boss mode". Plain Spring service so it looks like ordinary work.
window.FAKE_CODE = `package com.workspace.order.application;

import com.workspace.order.domain.Order;
import com.workspace.order.domain.OrderLine;
import com.workspace.order.domain.OrderRepository;
import com.workspace.order.domain.OrderStatus;
import com.workspace.order.application.dto.OrderCommand;
import com.workspace.order.application.dto.OrderResult;
import com.workspace.common.exception.BusinessException;
import com.workspace.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Order application service.
 * Handles order placement, validation and status transitions.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private static final int MAX_LINES = 50;

    private final OrderRepository orderRepository;
    private final InventoryClient inventoryClient;
    private final PriceCalculator priceCalculator;

    @Transactional
    public OrderResult place(OrderCommand command) {
        validate(command);

        List<OrderLine> lines = command.lines().stream()
                .map(l -> new OrderLine(l.productId(), l.quantity()))
                .toList();

        inventoryClient.reserve(lines);

        BigDecimal total = priceCalculator.calculate(lines, command.couponCode());
        Order order = Order.create(command.customerId(), lines, total);
        orderRepository.save(order);

        log.info("order placed: id={}, total={}", order.getId(), total);
        return OrderResult.from(order);
    }

    @Transactional
    public void cancel(Long orderId, String reason) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));

        if (order.getStatus() == OrderStatus.SHIPPED) {
            throw new BusinessException(ErrorCode.ORDER_ALREADY_SHIPPED);
        }

        // TODO: publish OrderCancelledEvent once the outbox is ready
        order.cancel(reason, LocalDateTime.now());
        inventoryClient.release(order.getLines());
    }

    @Transactional(readOnly = true)
    public List<OrderResult> findRecent(Long customerId, int limit) {
        return orderRepository.findTopByCustomerId(customerId, limit).stream()
                .map(OrderResult::from)
                .toList();
    }

    private void validate(OrderCommand command) {
        if (command.lines() == null || command.lines().isEmpty()) {
            throw new BusinessException(ErrorCode.EMPTY_ORDER);
        }
        if (command.lines().size() > MAX_LINES) {
            throw new BusinessException(ErrorCode.TOO_MANY_LINES);
        }
    }
}
`;

window.highlightJava = function (src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const re = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|(@\w+)|\b(\d+)\b|\b([a-z]\w*)(?=\()|\b(package|import|public|private|protected|static|final|class|return|new|if|throw|void|int|null|this)\b/g;
  let out = '', last = 0, m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    const [t] = m;
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'a' : m[4] ? 'n' : m[5] ? 'f' : 'k';
    out += `<span class="${cls}">${esc(t)}</span>`;
    last = m.index + t.length;
  }
  return out + esc(src.slice(last));
};
