package com.solarintegrators.inventory;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Entry point for the Cloud Inventory Management System REST API.
 *
 * <p>Replaces {@code Main.java}, which wired the repositories and services by
 * hand and ran a scripted demonstration. That demonstration is preserved: run
 * the application with the {@code demo} profile and
 * {@code DemoDataRunner} performs the same scenario through the same services,
 * now against a real database.</p>
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class InventoryApplication {

    public static void main(String[] args) {
        SpringApplication.run(InventoryApplication.class, args);
    }
}
