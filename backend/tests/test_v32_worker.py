from concurrent.futures import ThreadPoolExecutor
from threading import Event, Thread

import pytest

from neuroinsight_api.inference_execution import InferenceBusyError
from neuroinsight_api.v32_worker import WorkerClient, WorkerServer


def test_worker_stays_ready_and_rejects_a_second_prediction(tmp_path):
    started = Event()
    release = Event()

    class Pipeline:
        def predict(self, image):
            assert image == b"first"
            started.set()
            assert release.wait(5)
            return {"prediction": "complete"}

    socket = tmp_path / "v32.sock"
    with WorkerServer(str(socket), Pipeline()) as server:
        serving = Thread(target=server.serve_forever)
        serving.start()
        try:
            client = WorkerClient(socket)
            assert client.ready()
            with ThreadPoolExecutor(max_workers=1) as pool:
                first = pool.submit(client.predict, b"first")
                try:
                    assert started.wait(2)
                    assert client.ready()
                    with pytest.raises(InferenceBusyError):
                        client.predict(b"second")
                finally:
                    release.set()
                assert first.result(timeout=2) == {"prediction": "complete"}
                assert client.ready()
        finally:
            server.shutdown()
            serving.join()
