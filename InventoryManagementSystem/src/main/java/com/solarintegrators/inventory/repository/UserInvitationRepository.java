package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.InvitationPurpose;
import com.solarintegrators.inventory.model.UserInvitation;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserInvitationRepository extends JpaRepository<UserInvitation, UUID> {
    Optional<UserInvitation> findByTokenHash(String tokenHash);

    List<UserInvitation> findByUserIdAndConsumedAtIsNull(UUID userId);

    List<UserInvitation> findByPurposeAndConsumedAtIsNull(InvitationPurpose purpose);
}
