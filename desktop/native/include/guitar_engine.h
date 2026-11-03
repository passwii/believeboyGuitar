#ifndef GUITAR_ENGINE_H
#define GUITAR_ENGINE_H

#include <stddef.h>
#include <stdint.h>

#if defined(_WIN32)
#define GUITAR_ENGINE_EXPORT __declspec(dllexport)
#else
#define GUITAR_ENGINE_EXPORT __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef struct guitar_engine guitar_engine;

/*
 * Thread safety
 * -------------
 * Every function below except guitar_engine_destroy may be called concurrently
 * from multiple threads on the same handle; calls are serialized internally by
 * a per-engine mutex, so overlapping snapshot polling, setters and graph
 * mutations are safe.
 *
 * guitar_engine_destroy must not overlap with any other call on the same
 * handle: the caller owns the handle until destroy returns, and the handle
 * must not be used afterwards.
 *
 * The realtime audio callback never acquires that mutex, so a device start or
 * stop may block a control call without blocking the audio thread.
 */

enum guitar_engine_result {
  GE_OK = 0,
  GE_BUFFER_TOO_SMALL = 1,
  GE_INVALID_ARGUMENT = 2,
  GE_INVALID_PARAMETER = 3,
  GE_BLOCK_NOT_FOUND = 4,
  GE_DEVICE_OPEN_FAILED = 5,
  GE_MODEL_LOAD_FAILED = 6,
  GE_NOT_RUNNING = 7,
  GE_INTERNAL_ERROR = 8,
  /* An audio update queue is full: the request was valid but could not be
     published to the audio thread yet, so the caller may retry. */
  GE_BUSY = 9
};

GUITAR_ENGINE_EXPORT uint32_t guitar_engine_abi_version(void);
GUITAR_ENGINE_EXPORT guitar_engine* guitar_engine_create(void);
GUITAR_ENGINE_EXPORT void guitar_engine_destroy(guitar_engine* engine);
GUITAR_ENGINE_EXPORT int guitar_engine_list_devices(guitar_engine* engine, char* json_out,
                                                     size_t capacity, size_t* written);
GUITAR_ENGINE_EXPORT int guitar_engine_start(guitar_engine* engine,
                                              const char* input_device_id, int input_channel,
                                              const char* output_device_id, int buffer_size);
GUITAR_ENGINE_EXPORT int guitar_engine_stop(guitar_engine* engine);
GUITAR_ENGINE_EXPORT int guitar_engine_set_input_gain(guitar_engine* engine, double gain_db);
GUITAR_ENGINE_EXPORT int guitar_engine_set_master_gain(guitar_engine* engine, double gain_db);
GUITAR_ENGINE_EXPORT int guitar_engine_add_file(guitar_engine* engine, const char* path,
                                                 char* block_id_out, size_t capacity,
                                                 size_t* written);
GUITAR_ENGINE_EXPORT int guitar_engine_remove_block(guitar_engine* engine, const char* block_id);
GUITAR_ENGINE_EXPORT int guitar_engine_reorder(guitar_engine* engine,
                                                const char* block_ids_json);
GUITAR_ENGINE_EXPORT int guitar_engine_set_param(guitar_engine* engine, const char* block_id,
                                                  const char* name, double value);
GUITAR_ENGINE_EXPORT int guitar_engine_snapshot(guitar_engine* engine, char* json_out,
                                                 size_t capacity, size_t* written);
GUITAR_ENGINE_EXPORT int guitar_engine_last_error(guitar_engine* engine, char* text_out,
                                                   size_t capacity, size_t* written);

#ifdef __cplusplus
}
#endif

#endif
