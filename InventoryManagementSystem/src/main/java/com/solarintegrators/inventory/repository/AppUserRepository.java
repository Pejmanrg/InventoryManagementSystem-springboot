package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.AppUser;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

/**
 * Persistence for {@link AppUser}.
 *
 * <p>Username lookups are case-insensitive to match the unique index on
 * {@code lower(username)}. Doing this in the query rather than by lower-casing
 * on the way in keeps whatever casing an administrator typed on the profile
 * screen, while still refusing a second account that differs only in case.</p>
 */
@Repository
public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    @Query("select u from AppUser u where lower(u.username) = lower(:username)")
    Optional<AppUser> findByUsernameIgnoreCase(String username);

    @Query("select case when count(u) > 0 then true else false end "
            + "from AppUser u where lower(u.username) = lower(:username)")
    boolean existsByUsernameIgnoreCase(String username);

    @Query("select case when count(u) > 0 then true else false end "
            + "from AppUser u where lower(u.email) = lower(:email) and u.userId <> :excludeId")
    boolean existsByEmailIgnoreCaseAndUserIdNot(String email, UUID excludeId);

    @Query("select case when count(u) > 0 then true else false end "
            + "from AppUser u where lower(u.email) = lower(:email)")
    boolean existsByEmailIgnoreCase(String email);

    List<AppUser> findAllByOrderByUsernameAsc();
}
