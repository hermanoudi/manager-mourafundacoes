import pytest

from moura_gestao.domain.jobs import JobStatus, can_transition

P, I, C, X = (
    JobStatus.PLANNED, JobStatus.IN_PROGRESS, JobStatus.COMPLETED, JobStatus.CANCELLED,
)


@pytest.mark.parametrize("src,dst", [(P, I), (P, X), (I, C), (I, X)])
def test_allowed_transitions(src, dst):
    assert can_transition(src, dst) is True


@pytest.mark.parametrize("src,dst", [(C, I), (X, P), (P, C), (P, P), (C, X), (X, I)])
def test_forbidden_transitions(src, dst):
    assert can_transition(src, dst) is False
