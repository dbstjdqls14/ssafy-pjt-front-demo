package com.ssafy.b109.aivo.practice.service;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.practice.dto.PracticeFolderCreateRequest;
import com.ssafy.b109.aivo.practice.dto.PracticeFolderResponse;
import com.ssafy.b109.aivo.practice.dto.PracticeFolderUpdateRequest;
import com.ssafy.b109.aivo.practice.entity.PracticeFolder;
import com.ssafy.b109.aivo.practice.repository.PracticeFolderRepository;
import com.ssafy.b109.aivo.practice.repository.PracticeRepository;
import com.ssafy.b109.aivo.user.entity.User;
import com.ssafy.b109.aivo.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class PracticeFolderService {

    private final PracticeFolderRepository practiceFolderRepository;
    private final PracticeRepository practiceRepository;
    private final UserRepository userRepository;

    public List<PracticeFolderResponse> findAll(Long userId, String type, String keyword) {
        List<PracticeFolder> folders = keyword == null || keyword.isBlank()
                ? practiceFolderRepository.findAllByUserIdOrderByIdDesc(userId)
                : practiceFolderRepository.findAllByUserIdAndNameContainingIgnoreCaseOrderByIdDesc(
                        userId,
                        keyword.trim()
                );

        return folders.stream()
                .map(folder -> toResponse(folder, type))
                .toList();
    }

    public PracticeFolderResponse find(Long userId, Long folderId, String type) {
        return toResponse(findOwnedFolder(userId, folderId), type);
    }

    @Transactional
    public PracticeFolderResponse create(Long userId, PracticeFolderCreateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new CustomException(
                                ErrorCode.NOT_FOUND_USER
                        )
                );

        PracticeFolder folder = new PracticeFolder();

        folder.setUser(user);
        folder.setName(request.name().trim());
        folder.setDescription(
                request.description() == null ? "" : request.description().trim()
        );

        PracticeFolder savedFolder = practiceFolderRepository.save(folder);

        return toResponse(savedFolder, request.type());

    }

    @Transactional
    public PracticeFolderResponse update(Long userId, Long folderId, PracticeFolderUpdateRequest request) {
        PracticeFolder folder = findOwnedFolder(userId, folderId);

        if (request.name() != null && !request.name().isBlank()) {
            folder.setName(request.name().trim());
        }
        if (request.description() != null) {
            folder.setDescription(request.description().trim());
        }

        return toResponse(folder, request.type());
    }

    @Transactional
    public void delete(Long userId, Long folderId) {
        PracticeFolder folder = findOwnedFolder(userId, folderId);
        practiceFolderRepository.delete(folder);
    }

    private PracticeFolder findOwnedFolder(Long userId, Long folderId) {
        return practiceFolderRepository.findByIdAndUserId(folderId, userId)
                .orElseThrow(() ->
                        new CustomException(
                                ErrorCode.NOT_FOUND_PRACTICE_FOLDER
                        )
                );
    }

    private PracticeFolderResponse toResponse(PracticeFolder folder, String type) {
        long practiceCount = practiceRepository.countByFolder_Id(folder.getId());
        return new PracticeFolderResponse(
                folder.getId(),
                folder.getName(),
                folder.getDescription(),
                normalizeType(type),
                practiceCount,
                practiceCount
        );
    }

    private String normalizeType(String type) {
        if (type == null || type.isBlank()) {
            return "presentation";
        }
        return "interview".equalsIgnoreCase(type.trim()) ? "interview" : "presentation";
    }
}
