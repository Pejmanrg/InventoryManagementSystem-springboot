package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.InvitationPurpose;
import com.solarintegrators.inventory.model.UserInvitation;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserInvitationRepository extends JpaRepository<UserInvitation, UUID> {

    /**
     * The only way a token is looked up. The caller hashes the token it was
     * given and searches by hash, so an attacker with read access to this table
     * still holds nothing they can put in a URL.
     */
    Optional<UserInvitation> findByTokenHash(String tokenHash);

    /** Outstanding links for an account, superseded when a new one is issued. */
    List<UserInvitation> findByUserIdAndConsumedAtIsNull(UUID userId);

    /** Backs the "invitation pending" marker in the users list. */
    List<UserInvitation> findByPurposeAndConsumedAtIsNull(InvitationPurpose purpose);
}
