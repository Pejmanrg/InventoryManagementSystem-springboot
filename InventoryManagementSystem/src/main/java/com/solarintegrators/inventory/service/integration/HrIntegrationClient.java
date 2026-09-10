package com.solarintegrators.inventory.service.integration;

import com.solarintegrators.inventory.model.Asset;

public interface HrIntegrationClient {
    int syncEmployees();

    void publishAssignment(Asset asset, String externalHrId);

    void publishReturn(Asset asset, String externalHrId);
}
