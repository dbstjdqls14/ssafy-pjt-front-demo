package com.ssafy.b109.aivo.global.rabbitmq.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.ExchangeBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String ANALYSIS_EXCHANGE = "analysis.exchange";

    public static final String LLM_QUEUE = "analysis.llm.queue";
    public static final String AUDIO_QUEUE = "analysis.audio.queue";
    public static final String RESULT_QUEUE = "analysis.result.queue";

    public static final String LLM_RETRY_QUEUE = "analysis.llm.retry.queue";
    public static final String AUDIO_RETRY_QUEUE = "analysis.audio.retry.queue";
    public static final String RESULT_RETRY_QUEUE = "analysis.result.retry.queue";

    public static final String DEAD_QUEUE = "analysis.dead.queue";

    public static final String LLM_ROUTING_KEY = "analysis.request.llm";
    public static final String AUDIO_ROUTING_KEY = "analysis.request.audio";
    public static final String RESULT_ROUTING_KEY = "analysis.result";

    public static final String LLM_RETRY_ROUTING_KEY = "analysis.retry.llm";
    public static final String AUDIO_RETRY_ROUTING_KEY = "analysis.retry.audio";
    public static final String RESULT_RETRY_ROUTING_KEY = "analysis.retry.result";

    public static final String DEAD_ROUTING_KEY = "analysis.dead";

    private static final int RETRY_DELAY_MILLISECONDS = 30_000;

    @Bean
    public DirectExchange analysisExchange() {
        return ExchangeBuilder
                .directExchange(ANALYSIS_EXCHANGE)
                .durable(true)
                .build();
    }

    @Bean
    public Queue llmQueue() {
        return retryableQueue(LLM_QUEUE, LLM_RETRY_ROUTING_KEY);
    }

    @Bean
    public Queue audioQueue() {
        return retryableQueue(AUDIO_QUEUE, AUDIO_RETRY_ROUTING_KEY);
    }

    @Bean
    public Queue resultQueue() {
        return retryableQueue(RESULT_QUEUE, RESULT_RETRY_ROUTING_KEY);
    }

    @Bean
    public Queue llmRetryQueue() {
        return retryQueue(LLM_RETRY_QUEUE, LLM_ROUTING_KEY);
    }

    @Bean
    public Queue audioRetryQueue() {
        return retryQueue(AUDIO_RETRY_QUEUE, AUDIO_ROUTING_KEY);
    }

    @Bean
    public Queue resultRetryQueue() {
        return retryQueue(RESULT_RETRY_QUEUE, RESULT_ROUTING_KEY);
    }

    @Bean
    public Queue deadQueue() {
        return QueueBuilder
                .durable(DEAD_QUEUE)
                .build();
    }

    @Bean
    public Binding llmBinding(
            @Qualifier("llmQueue") Queue queue,
            DirectExchange analysisExchange
    ) {
        return bind(queue, analysisExchange, LLM_ROUTING_KEY);
    }

    @Bean
    public Binding audioBinding(
            @Qualifier("audioQueue") Queue queue,
            DirectExchange analysisExchange
    ) {
        return bind(queue, analysisExchange, AUDIO_ROUTING_KEY);
    }

    @Bean
    public Binding resultBinding(
            @Qualifier("resultQueue") Queue queue,
            DirectExchange analysisExchange
    ) {
        return bind(queue, analysisExchange, RESULT_ROUTING_KEY);
    }

    @Bean
    public Binding llmRetryBinding(
            @Qualifier("llmRetryQueue") Queue queue,
            DirectExchange analysisExchange
    ) {
        return bind(queue, analysisExchange, LLM_RETRY_ROUTING_KEY);
    }

    @Bean
    public Binding audioRetryBinding(
            @Qualifier("audioRetryQueue") Queue queue,
            DirectExchange analysisExchange
    ) {
        return bind(queue, analysisExchange, AUDIO_RETRY_ROUTING_KEY);
    }

    @Bean
    public Binding resultRetryBinding(
            @Qualifier("resultRetryQueue") Queue queue,
            DirectExchange analysisExchange
    ) {
        return bind(queue, analysisExchange, RESULT_RETRY_ROUTING_KEY);
    }

    @Bean
    public Binding deadBinding(
            @Qualifier("deadQueue") Queue queue,
            DirectExchange analysisExchange
    ) {
        return bind(queue, analysisExchange, DEAD_ROUTING_KEY);
    }

    @Bean
    public JacksonJsonMessageConverter jsonMessageConverter() {
        return new JacksonJsonMessageConverter();
    }

    private Queue retryableQueue(String queueName, String retryRoutingKey) {
        return QueueBuilder
                .durable(queueName)
                .deadLetterExchange(ANALYSIS_EXCHANGE)
                .deadLetterRoutingKey(retryRoutingKey)
                .build();
    }

    private Queue retryQueue(String queueName, String originalRoutingKey) {
        return QueueBuilder
                .durable(queueName)
                .ttl(RETRY_DELAY_MILLISECONDS)
                .deadLetterExchange(ANALYSIS_EXCHANGE)
                .deadLetterRoutingKey(originalRoutingKey)
                .build();
    }

    private Binding bind(Queue queue, DirectExchange exchange, String routingKey) {
        return BindingBuilder
                .bind(queue)
                .to(exchange)
                .with(routingKey);
    }
}
