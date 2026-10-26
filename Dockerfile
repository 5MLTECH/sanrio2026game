FROM php:8.5.11-apache

ENV TZ=Asia/Manila

RUN a2enmod headers rewrite

COPY docker/apache.conf /etc/apache2/conf-available/application.conf
COPY php.ini /usr/local/etc/php/conf.d/zz-application.ini
RUN a2enconf application

WORKDIR /var/www/html
COPY --chown=www-data:www-data . /var/www/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["php", "-r", "exit(file_get_contents('http://127.0.0.1/health.php') === false ? 1 : 0);"]
