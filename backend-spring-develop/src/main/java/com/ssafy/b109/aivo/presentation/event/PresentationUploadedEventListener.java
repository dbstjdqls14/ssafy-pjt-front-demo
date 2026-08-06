package com.ssafy.b109.aivo.presentation.event;

import com.ssafy.b109.aivo.presentation.service.PresentationProcessingService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class PresentationUploadedEventListener {

    private final PresentationProcessingService processingService;

    @Async("presentationTaskExecutor")
    @TransactionalEventListener(
            phase = TransactionPhase.AFTER_COMMIT
    )
    public void handle(PresentationUploadEvent event) {
        processingService.process(
                event.presentationId()
        );
    }
}
