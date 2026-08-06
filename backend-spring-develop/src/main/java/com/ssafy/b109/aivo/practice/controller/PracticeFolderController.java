package com.ssafy.b109.aivo.practice.controller;

import com.ssafy.b109.aivo.practice.dto.PracticeFolderCreateRequest;
import com.ssafy.b109.aivo.practice.dto.PracticeFolderResponse;
import com.ssafy.b109.aivo.practice.dto.PracticeFolderUpdateRequest;
import com.ssafy.b109.aivo.practice.dto.PresentationPracticeListResponse;
import com.ssafy.b109.aivo.practice.service.PracticeFolderService;
import com.ssafy.b109.aivo.practice.service.PracticeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("${API_VERSION}/practice-folders")
@RequiredArgsConstructor
public class PracticeFolderController {

    private final PracticeFolderService folderService;
    private final PracticeService practiceService;

    @GetMapping
    public ResponseEntity<List<PracticeFolderResponse>> getFolders(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String keyword
    ) {
        return ResponseEntity.ok(folderService.findAll(userId, type, keyword));
    }

    @GetMapping("/{folderId}")
    public ResponseEntity<PracticeFolderResponse> getFolder(
            @PathVariable Long folderId,
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) String type
    ) {
        return ResponseEntity.ok(folderService.find(userId, folderId, type));
    }

    @PostMapping
    public ResponseEntity<PracticeFolderResponse> createFolder(
            @Valid @RequestBody PracticeFolderCreateRequest request,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(
                        folderService.create(
                                userId,
                                request
                        )
                );
    }

    @PatchMapping("/{folderId}")
    public ResponseEntity<PracticeFolderResponse> updateFolder(
            @PathVariable Long folderId,
            @Valid @RequestBody PracticeFolderUpdateRequest request,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(folderService.update(userId, folderId, request));
    }

    @DeleteMapping("/{folderId}")
    public ResponseEntity<Void> deleteFolder(
            @PathVariable Long folderId,
            @AuthenticationPrincipal Long userId
    ) {
        folderService.delete(userId, folderId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{folderId}/presentation-practices")
    public ResponseEntity<PresentationPracticeListResponse>
    getPresentationPractices(
            @PathVariable Long folderId,
            @AuthenticationPrincipal Long userId
    ) {
        PresentationPracticeListResponse response =
                practiceService
                        .getPresentationPractices(
                                userId,
                                folderId
                        );

        return ResponseEntity.ok(response);
    }
}
